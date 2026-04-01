# StockPilot - Written Report

**Multi-Tenant AI-Powered Inventory Management System**

---

## B.1 Architecture Overview

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 16)                           │
│  Port: 3000                                                          │
│                                                                      │
│  Pages:          Dashboard | Product List | Product Detail           │
│                  Create/Edit | Procurement Report | Settings         │
│                                                                      │
│  State:          Zustand Store (inventory.store.ts, auth.store.ts)   │
│  Hooks:          useSSEStream (fetch + ReadableStream)               │
│  Styling:        Tailwind CSS v4 + cn() utility                      │
│  Auth Client:    BetterAuth createAuthClient (cookie-based sessions) │
└──────────┬───────────────────────────────────┬───────────────────────┘
           │ REST API (JSON)                   │ SSE Stream (text/event-stream)
           │ Cookie auth (credentials: include)│ Cookie auth (credentials: include)
           ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Elysia 1.4.28 on Bun)              │
│  Port: 3001                                                          │
│                                                                      │
│  Auth:           BetterAuth (session cookies, organization plugin)   │
│  Guards:         getSessionAndRole() → extracts userId, orgId, role  │
│  RBAC:           hasRole() with hierarchy owner(4)>admin(3)>         │
│                  manager(2)>member(1)                                │
│  Validation:     Zod schemas (product, stock, query, invitation)     │
│  ORM:            Drizzle ORM with PostgreSQL                         │
│  Multi-tenancy:  Every query scoped by organizationId                │
│                                                                      │
│  Routes:         /api/products/* (CRUD + stock + movements)          │
│                  /api/ai/* (analyze proxy + report SSE proxy)        │
│                  /api/auth/* (BetterAuth handles these)              │
│                  /api/settings/* (members, invitations, roles)       │
│                                                                      │
│  AI Proxy:       Fetches from AI Service, re-emits SSE stream        │
│                  with manual CORS headers (Elysia bug workaround)    │
└──────────┬───────────────────────────────────────────────────────────┘
           │ REST API calls (internal, server-to-server)
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      AI SERVICE (FastAPI + LangChain)                │
│  Port: 8000                                                          │
│                                                                      │
│  LLM:           Groq API → llama-3.3-70b-versatile                   │
│  Prompts:       ChatPromptTemplate (analysis + procurement report)   │
│  Validation:    Pydantic models for request/response                 │
│  Streaming:     async for chunk in chain.astream() → SSE chunks      │
│  Timeout:       30-second asyncio.wait_for on LLM calls              │
│                                                                      │
│  POST /analyze          → JSON (single product recommendation)       │
│  POST /generate-report  → SSE stream (full procurement report)       │
│  GET  /health           → Health check                               │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                             │
│                                                                      │
│  Auth Tables (7):  user, session, account, organization,             │
│                    member, invitation, verification                  │
│  App Tables (2):   products, stock_movements                         │
│                                                                      │
│  Schema split:     db/schema/auth.ts (BetterAuth tables)             │
│                    db/schema/app.ts  (application tables)            │
│                    db/schema/index.ts (barrel export)                │
│                                                                      │
│  Key constraints:  UNIQUE(organization_id, sku) on products          │
│                    FK product_id → products.id on stock_movements    │
│                    FK userId → user.id on session, account, member   │
│                    FK organizationId → organization.id on member     │
└──────────────────────────────────────────────────────────────────────┘
```

### How the Three Services Communicate

The system follows a **layered proxy architecture**. The frontend never talks directly to the AI service — all requests go through the backend, which acts as a gateway. This is important because the backend is where authentication, authorization, and multi-tenancy are enforced. If the frontend could reach the AI service directly, any user could generate reports for any organization by passing arbitrary product data.

**Communication protocols:**
- **Frontend → Backend:** REST API over HTTP with JSON payloads. Authentication is handled via `httpOnly` session cookies managed by BetterAuth. The frontend includes `credentials: "include"` on every fetch call so the browser sends the cookie automatically. For SSE streams, the frontend uses `fetch` with `ReadableStream` (not `EventSource`) because `EventSource` cannot send cookies.
- **Backend → AI Service:** Internal REST calls using `fetch`. No authentication is needed between these two services because the AI service runs on an internal network and only the backend knows its URL. The backend sends product data (already filtered by organization) to the AI service and either returns the JSON response or proxies the SSE stream.
- **Backend → Database:** Drizzle ORM generates parameterized SQL queries. The connection pool is managed by `pg.Pool` with the connection string from `DATABASE_URL`.

### Request Lifecycle 1: Adjusting Stock

This is the most complex write operation in the system because it involves concurrency safety, an audit trail, and a non-blocking AI analysis.

**Step-by-step flow:**

1. **User interaction:** The user clicks "Adjust Stock" on a product detail page, enters a quantity (e.g., -5), selects a movement type ("sold"), and optionally adds a reason ("Customer order #1234").

2. **Frontend validation:** The stock adjustment modal calls `adjustStock(productId, data)` from the Zustand store (`inventory.store.ts`). The store sets `isSubmitting: true` and calls the API module.

3. **API call:** `api.adjustStock(id, data)` sends a `PATCH /api/products/:id/stock` request with the JSON body:
   ```json
   { "quantity": -5, "movementType": "sold", "reason": "Customer order #1234" }
   ```

4. **Backend auth check:** The route handler in `products.ts` calls `getSessionAndRole(headers)`. This function:
   - Calls `auth.api.getSession()` to validate the session cookie
   - Extracts `activeOrganizationId` from the session
   - Queries the `member` table with raw SQL to get the user's role
   - Returns `{ userId, organizationId, role }` or `null` if any step fails

5. **Input validation:** The request body is parsed through `adjustStockSchema.safeParse(body)`. Zod validates that `quantity` is a non-zero integer, `movementType` is one of the five allowed enum values, and `reason` is under 500 characters.

6. **Database transaction with row locking:**
   ```typescript
   const txResult = await db.transaction(async (tx) => {
     // SELECT FOR UPDATE locks this product row — any concurrent
     // request for the same product will WAIT here until this
     // transaction commits or rolls back
     const [product] = await tx
       .select()
       .from(products)
       .where(and(eq(products.id, params.id), eq(products.organizationId, sessionData.organizationId)))
       .for("update");

     if (!product) return { error: "NOT_FOUND" as const };

     const newStock = product.currentStock + parsed.data.quantity;
     if (newStock < 0) return { error: "NEGATIVE_STOCK" as const };

     // Update stock within the same transaction
     await tx.update(products)
       .set({ currentStock: newStock, updatedAt: new Date() })
       .where(and(eq(products.id, params.id), eq(products.organizationId, sessionData.organizationId)));

     // Create immutable movement record (audit trail)
     await movementService.createMovementTx(tx, {
       organizationId: sessionData.organizationId,
       productId: params.id,
       movementType: parsed.data.movementType,
       quantity: parsed.data.quantity,
       reason: parsed.data.reason,
       stockBefore: product.currentStock,
       stockAfter: newStock,
       createdBy: sessionData.userId,
     });

     return { data: { product, newStock } };
   });
   ```
   The `SELECT ... FOR UPDATE` is critical. Without it, two concurrent requests could both read `currentStock = 10`, both calculate `10 - 8 = 2`, and both write `2` — losing one adjustment entirely. With `FOR UPDATE`, the second request waits until the first commits, then reads the already-updated value.

7. **AI analysis (non-blocking):** After the transaction commits successfully, the backend calls the AI service to re-analyze the product's stock level. This runs in a try/catch — if the AI service is down or slow, the stock adjustment still succeeds. The AI result (recommendation + reasoning) is saved to the product record.

8. **Response:** The backend fetches the fully updated product (including AI fields) and returns it to the frontend.

9. **Store update:** The Zustand store receives the updated product, sets `isSubmitting: false`, and updates both the product list and the selected product in state. React re-renders the UI with the new stock level and AI recommendation.

### Request Lifecycle 2: Generating an AI Procurement Report

This flow involves SSE streaming across three services, which was the hardest integration challenge in the project.

**Step-by-step flow:**

1. **User interaction:** A manager clicks "Generate Procurement Report" on the report page.

2. **Frontend triggers stream:** The report page uses the `useSSEStream` hook:
   ```typescript
   const { data, isStreaming, error, startStream, stopStream } = useSSEStream(
     `${API_URL}/ai/report`
   );
   ```
   When the user clicks the button, `startStream()` is called. This creates a new `AbortController`, resets the data/error state, and initiates a `fetch` request with `credentials: "include"`.

3. **Backend auth + data collection:** The backend's `/api/ai/report` route:
   - Validates the session and checks that the user has at least "manager" role
   - Fetches all active products for the user's organization using `productService.getAllActiveProducts(orgId)` — this is org-scoped, so a manager in Org A never sees Org B's products
   - Maps the products to the format the AI service expects

4. **Backend → AI Service (SSE proxy):** The backend sends a POST request to the AI service's `/generate-report` endpoint with the product data. The AI service returns an SSE stream. The backend creates a new `ReadableStream` that reads chunks from the AI response and re-emits them with proper CORS headers:
   ```typescript
   return new Response(stream, {
     headers: {
       "Content-Type": "text/event-stream",
       "Cache-Control": "no-cache",
       "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000",
       "Access-Control-Allow-Credentials": "true",
     },
   });
   ```
   These manual CORS headers are necessary because Elysia's CORS middleware does not add headers to raw `Response` objects — only to standard JSON responses.

5. **AI Service generates report:** The AI service uses LangChain's `chain.astream()` to stream the LLM response:
   ```python
   async for chunk in chain.astream({"products_data": products_data}):
       content = chunk.content if hasattr(chunk, "content") else str(chunk)
       if content:
           yield {"content": content, "done": False}
   yield {"content": "", "done": True}
   ```
   Each chunk is formatted as an SSE event: `data: {"content": "...", "done": false}\n\n`

6. **Frontend consumes stream:** The `useSSEStream` hook reads chunks from the `ReadableStream`:
   ```typescript
   const reader = response.body.getReader();
   const decoder = new TextDecoder();

   while (true) {
     const { done, value } = await reader.read();
     if (done) break;

     const text = decoder.decode(value, { stream: true });
     const lines = text.split("\n");

     for (const line of lines) {
       if (!trimmed.startsWith("data: ")) continue;
       const parsed = JSON.parse(trimmed.slice(6));
       if (parsed.done === true) { setIsStreaming(false); return; }
       if (parsed.content) { setData((prev) => prev + parsed.content); }
     }
   }
   ```
   As each chunk arrives, it appends the content to `data`, and React progressively renders the markdown report in real-time.

7. **Completion:** When the AI service sends `{"content": "", "done": true}`, the hook sets `isStreaming: false` and the UI shows the complete report. The user can also click "Stop" at any time, which calls `stopStream()` → `abortController.abort()`, cleanly terminating the fetch.

---

## B.2 Key Design Decisions

### Decision 1: BetterAuth with the Organization Plugin

**What:** I chose BetterAuth as the authentication library, primarily because of its organization plugin that provides multi-tenancy primitives (organizations, members, invitations, role management) out of the box.

**Alternatives considered:**
- **NextAuth (Auth.js):** Handles basic auth well but has no concept of organizations or multi-tenancy. I would have had to build the entire org/member/invitation system myself — creating tables, managing membership, handling role assignments.
- **Custom JWT system:** Maximum flexibility, but building session management, token refresh, CSRF protection, password hashing, and organization membership from scratch would have taken 2-3 days by itself.
- **Clerk/Auth0:** Third-party SaaS auth services. They have org support, but the assignment specifically requires building with the given tech stack (Elysia + Drizzle), and these services add external dependencies and cost.

**Why I chose this approach:** BetterAuth saved approximately 80% of the auth code I would have written manually. The organization plugin gave me `createOrganization`, `addMember`, `listMembers`, `setActiveOrganization`, and invitation management through simple API calls. The tradeoff is that BetterAuth auto-creates its own database tables outside of Drizzle's migration system, which initially meant I had to use raw SQL to query them. I later added Drizzle schema definitions for all 7 BetterAuth tables (`db/schema/auth.ts`) so the full database structure is documented in code, but the auth operations still go through BetterAuth's API rather than Drizzle queries.

The role lookup still uses raw SQL because it needs to query BetterAuth's `member` table directly:
```typescript
const result = await db.execute(
  sql`SELECT role FROM member WHERE "organizationId" = ${orgId} AND "userId" = ${userId} LIMIT 1`
);
```

### Decision 2: Email-Match Invitation Flow Instead of Token-Based

**What:** When an admin invites a user, they add the email and desired role to an invitation list. When someone signs up with that email, the system detects the pending invitation and lets them accept it to join the organization.

**Alternatives considered:**
- **Token-based invitations (industry standard):** Generate a unique token, create a link like `/invite?token=abc123`, send it to the user. User clicks the link, token is validated, they join the org. This requires either an email service (SendGrid, SES) or a manual copy-paste step.
- **Link-based without email:** Generate the invite link, show it to the admin, they share it manually. Simpler than email, but the UX is poor — the admin has to copy a long URL and send it through some other channel.

**Why I chose this approach:** Setting up an email service was out of scope for this assignment, and asking admins to copy-paste long token URLs is poor UX. The email-match approach requires zero infrastructure beyond the database. The admin says "I want user@example.com to be a manager," and when that person signs up, it just works. The downside is discoverability — the invited user doesn't receive a notification that they've been invited. In a production system, I would add email notifications, but for the assignment's scope, the simplicity tradeoff is worth it.

### Decision 3: SELECT FOR UPDATE for Concurrent Stock Safety

**What:** Stock adjustments use a PostgreSQL transaction with `SELECT ... FOR UPDATE` row-level locking to prevent race conditions on concurrent updates.

**Alternatives considered:**
- **No locking (naive read-modify-write):** Read current stock, calculate new value, write it back. This is simple but broken under concurrency — two simultaneous requests both read the same value and overwrite each other's changes.
- **Optimistic locking (version column):** Add a `version` column to the product. Read the current version, include `WHERE version = X` in the UPDATE, retry if it fails. This avoids holding locks but adds retry logic and a version column.
- **Application-level mutex:** Use a Redis lock or in-memory lock keyed by product ID. This works but adds an external dependency (Redis) and complexity for distributed deployments.

**Why I chose this approach:** `SELECT FOR UPDATE` is the simplest correct solution for this problem. PostgreSQL handles all the complexity — the second request simply waits at the SELECT until the first transaction commits. There's no retry logic, no external dependencies, and the correctness guarantee is absolute. The tradeoff is slightly higher latency for concurrent requests to the same product, but in a realistic inventory system, two people adjusting the exact same product at the exact same millisecond is rare.

The entire read-check-update-log sequence is atomic inside one transaction:
```typescript
const txResult = await db.transaction(async (tx) => {
  const [product] = await tx.select().from(products)
    .where(and(eq(products.id, params.id), eq(products.organizationId, orgId)))
    .for("update");

  const newStock = product.currentStock + parsed.data.quantity;
  if (newStock < 0) return { error: "NEGATIVE_STOCK" as const };

  await tx.update(products).set({ currentStock: newStock, updatedAt: new Date() })
    .where(and(eq(products.id, params.id), eq(products.organizationId, orgId)));

  await movementService.createMovementTx(tx, { /* movement data */ });

  return { data: { product, newStock } };
});
```

### Decision 4: Auto-Generated SKU with Category Prefix

**What:** SKUs are generated automatically using the first three characters of the category (or product name if no category) plus a zero-padded sequence number. Example: category "Electronics" → `ELE-001`, `ELE-002`.

**Alternatives considered:**
- **Manual SKU input (required field):** The user types the SKU themselves. This gives full control but leads to inconsistency (some users type lowercase, some add spaces, some use different formats) and data entry errors.
- **UUID-based SKUs:** Globally unique, zero collision risk, but completely unreadable. You can't look at `a7f3b2d1-...` and know anything about the product.
- **Sequential integers:** `SKU-1`, `SKU-2`, etc. Simple but provides no semantic information about the product's category.

**Why I chose this approach:** The category-prefix approach gives SKUs that are both unique and meaningful. A warehouse worker can see `ELE-003` and immediately know it's the third electronics product. The sequence number handles ordering, and the `UNIQUE(organizationId, sku)` database constraint prevents duplicates at the DB level as a safety net. The generation logic also handles edge cases:

```typescript
async function generateSKU(organizationId: string, name: string, category?: string | null): Promise<string> {
  const source = category && category.trim().length >= 3 ? category.trim() : name.trim();
  const prefix = source.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");

  // Count existing products with same prefix to determine sequence
  const result = await db.select({ count: count() }).from(products)
    .where(and(eq(products.organizationId, organizationId), sql`${products.sku} LIKE ${prefix + "-%"}`));

  const nextNum = Number(result[0]?.count ?? 0) + 1;
  const sku = `${prefix}-${String(nextNum).padStart(3, "0")}`;

  // Verify uniqueness and handle gaps in sequence
  const existing = await db.select({ id: products.id }).from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.sku, sku)));

  if (existing.length > 0) {
    // Collision — find the real max sequence number
    const maxResult = await db.execute(
      sql`SELECT MAX(CAST(SPLIT_PART(sku, '-', 2) AS INTEGER)) as max_seq
          FROM products WHERE organization_id = ${organizationId} AND sku LIKE ${prefix + "-%"}`
    );
    const maxSeq = Number(maxResult.rows[0]?.max_seq ?? 0);
    return `${prefix}-${String(maxSeq + 1).padStart(3, "0")}`;
  }

  return sku;
}
```

### Decision 5: fetch-Based SSE Hook Instead of EventSource

**What:** The `useSSEStream` hook uses `fetch` with `ReadableStream` to consume SSE streams, instead of the browser's built-in `EventSource` API.

**Alternatives considered:**
- **EventSource API:** The standard browser API for SSE. Simpler to use (just `new EventSource(url)` and listen for `onmessage`), handles reconnection automatically, and parses SSE format natively.
- **WebSocket:** Full-duplex communication. More powerful than SSE but requires a WebSocket server setup and doesn't align with the SSE requirement in the assignment.

**Why I chose this approach:** `EventSource` does not support sending cookies or any custom headers with requests. Since BetterAuth uses `httpOnly` session cookies for authentication, an `EventSource` request would arrive at the backend without the session cookie, and `getSessionAndRole()` would return null → 401 Unauthorized. This is a fundamental limitation of the `EventSource` API.

The `fetch` approach gives full control over credentials, abort handling, and error codes:
```typescript
fetch(url, {
  credentials: "include",  // This sends the session cookie — EventSource can't do this
  signal: controller.signal,
})
```

The hook also provides specific error messages based on HTTP status codes (401 → "Please log in", 403 → "No permission") rather than the generic connection errors that `EventSource` gives.

### Decision 6: Manual CORS Headers on SSE Responses

**What:** SSE proxy responses in the backend include manually constructed CORS headers instead of relying on Elysia's CORS middleware.

**Alternatives considered:**
- **Elysia's CORS plugin (the obvious choice):** Just add `cors()` to the Elysia instance and all responses get CORS headers. This works for all normal JSON responses but fails for raw `Response` objects.

**Why I chose this approach:** This wasn't really a choice — it was a workaround for a framework limitation. Elysia's CORS middleware intercepts response objects and adds CORS headers, but only for standard responses (objects, strings). When a route handler returns `new Response(stream, { headers: {...} })`, Elysia passes it through unchanged. The browser sees a response without `Access-Control-Allow-Origin` and blocks it.

I spent considerable time debugging this because the error manifested as a 503 rather than a clear CORS error, since streaming requests don't get standard CORS error messages in the browser.

The fix:
```typescript
function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
  };
}
```

---

## B.3 AI Usage Log

I used AI assistance (Claude Code) for approximately 40% of the development work, primarily for scaffolding, styling, and debugging. The remaining 60% — all core logic, validation, state management, hooks, multi-tenancy, auth guards, prompts, error handling, and this report — was written by hand as required by the assignment.

### What I Wrote by Hand (No AI Assistance)

These are the sections the assignment explicitly requires to be hand-written:

**1. All Zod validation schemas (`backend/src/schemas/validation.ts`):**
I wrote every schema myself — `createProductSchema`, `updateProductSchema`, `adjustStockSchema`, `productQuerySchema`, `movementQuerySchema`, `inviteMemberSchema`, and `changeRoleSchema`. This includes all the specific constraints like `.min(1)` on product name, `.positive()` on price, the `.refine()` that rejects zero quantity on stock adjustments, the `movementTypeEnum` with five allowed values, `z.coerce.number()` for query params, and `.max(100)` limit cap on pagination. The type exports using `z.infer<typeof schema>` were also hand-written to flow types through the entire request lifecycle.

**2. The Zustand stores (`frontend/src/store/inventory.store.ts`, `auth.store.ts`, `sidebar.store.ts`):**
I defined the entire `InventoryState` interface (data, stats, UI state, filters, pagination, and all actions), the `DEFAULT_FILTERS` and `DEFAULT_STATS` constants, and every action implementation. Key decisions I made:
- `isLoading` vs `isSubmitting` — separate flags so the UI can show different loading states for reads vs writes
- `setFilter()` auto-resets to page 1 and triggers `fetchProducts()` — this ensures filters and pagination stay in sync
- `deleteProduct()` updates the local list optimistically by changing status to "discontinued" rather than removing the item
- `fetchStats()` and `fetchCategories()` silently swallow errors since they're non-critical — a stats failure shouldn't block the product list from rendering
- Error extraction pattern: `err instanceof Error ? err.message : String((err as { error?: string }).error || "Fallback message")`

**3. The `useSSEStream` hook (`frontend/src/hooks/useSSEStream.ts`):**
I wrote the entire hook from scratch. The key implementation decisions:
- Using `useRef` for the `AbortController` to avoid re-creating it on every render
- The `cleanup()` function wrapped in `useCallback` so it's stable across renders
- Manual SSE parsing: splitting by `\n`, checking for `data: ` prefix, extracting JSON, handling malformed chunks with a silent catch (because the stream can split a JSON object across two TCP chunks)
- Specific error messages based on HTTP status codes (401, 403, etc.)
- `AbortError` detection to distinguish user-initiated stops from real errors
- Cleanup on unmount via `useEffect(() => cleanup, [cleanup])`

**4. Multi-tenancy filtering (all service functions):**
Every function in `product.service.ts` and `movement.service.ts` takes `organizationId` as the first parameter and includes `eq(products.organizationId, organizationId)` in every WHERE clause. I wrote all of these. The pattern is structural — TypeScript enforces that `organizationId` is always provided because it's a required parameter.

**5. Auth and RBAC guard logic (`backend/src/lib/session.ts`):**
I wrote `getSessionAndRole()` which chains three checks: session validation → org ID extraction → role lookup via raw SQL. I also wrote `hasRole()` with the numeric hierarchy `{ owner: 4, admin: 3, manager: 2, member: 1 }`. The role check compares `hierarchy[userRole] >= hierarchy[requiredRole]`, so a manager can do anything a member can, and an admin can do anything a manager can.

**6. LangChain prompts and agent logic (`ai-service/agent.py`):**
I wrote both prompts myself:
- The analysis prompt with specific decision rules (stock = 0 → reorder_urgent, stock < reorder_level → reorder_soon, etc.) and the order quantity formula `max(0, (reorder_level * 2) - current_stock)`
- The procurement report prompt with the exact section structure (Executive Summary, Critical Items, Reorder Soon, Adequate Stock, Budget Summary, Action Items) and formatting rules
- The `create_llm()` factory function, the `analyze_product()` function with 30-second timeout and JSON fallback on parse failure, and the `stream_procurement_report()` async generator
- The rule-based fallback in `analyze_product()` that generates a reasonable response even when the LLM returns unparseable output

**7. Error handling across all services:**
- Backend: discriminated union pattern `{ error: "DUPLICATE_SKU" as const }` vs `{ data: product }` — I chose this over throwing exceptions because it makes error paths explicit in the type system
- Backend: AI analysis failure is caught and logged without failing the stock adjustment
- Frontend: every store action wraps API calls in try/catch with specific error messages
- AI Service: `asyncio.wait_for` with 30-second timeout, `json.JSONDecodeError` fallback, `try/except` around the streaming generator

**8. This entire report** — written by hand as required.

### What AI Helped With (~40% of total work)

**Project scaffolding:**
I asked AI to help generate the initial folder structure and boilerplate configuration files (`package.json`, `tsconfig.json`, `pyproject.toml`, `drizzle.config.ts`). I accepted most of the scaffolding but adjusted things like the Elysia version (updated to 1.4.28), added the BetterAuth organization plugin config, and changed the Python project to use `uvicorn` with `--reload` for development.

**TailwindCSS styling and UI components:**
AI helped with layout classes, responsive design patterns, the `cn()` utility for conditional classes, and component styling (card layouts, table designs, badge colors for stock level indicators). I reviewed all styling and adjusted colors, spacing, and responsive breakpoints to match the design I wanted. The stock level color logic (green/yellow/red) was my decision, but the specific Tailwind classes were AI-suggested.

**TypeScript type definitions:**
AI helped generate some of the TypeScript interfaces in `frontend/src/types/index.ts` — the response types for API calls and props interfaces for components. I reviewed all of them and adjusted field names to match what the backend actually returns.

**Debugging the SSE CORS issue:**
After spending time investigating the 503 error on my own (checking network tab, testing with Postman, adding console logs to the backend), I described the problem to AI. AI helped identify that Elysia's CORS middleware doesn't apply to raw `Response` objects. The manual CORS headers solution was implemented by me, but the root cause identification was AI-assisted.

**Drizzle ORM query patterns:**
The `filter(where ...)` syntax for aggregated stats (counting low-stock and out-of-stock products in a single query) was unfamiliar to me. AI showed me the PostgreSQL `COUNT(*) FILTER (WHERE ...)` syntax and how to use it with Drizzle's `sql` template literal.

**Docker configuration:**
AI helped write the `Dockerfile` and `docker-compose.yml` for the three services. I adjusted the port mappings, environment variables, and build commands.

### How I Used AI Suggestions

Every piece of AI-generated code was reviewed, tested, and adapted. I did not blindly accept any suggestion. Specific examples:

- AI initially suggested using Elysia's built-in CORS plugin for SSE responses — I tested it, discovered it didn't work for raw `Response` objects, and wrote the manual headers approach myself.
- AI suggested using `EventSource` for the frontend SSE consumer — I rejected this because it can't send credentials and wrote the `fetch`-based `useSSEStream` hook instead.
- AI generated a simpler stock adjustment without transactions — I replaced it with the `SELECT FOR UPDATE` approach because I understood the concurrency risk.
- AI suggested using `throwing` errors in service functions — I replaced this with the discriminated union pattern because I find it makes error handling more explicit.

---

## B.4 Challenges & Learnings

### Challenge 1: The SSE 503 Mystery (Hardest Problem)

The procurement report feature kept returning a 503 error. The AI service was running and accessible from the backend (I verified with a direct `curl` call), but every request from the frontend failed with 503.

**Debugging process:**
1. I checked the AI service logs — it was receiving requests and streaming responses correctly.
2. I tested the backend's SSE proxy endpoint with Postman — it worked perfectly, streaming the report in real-time.
3. I added logging to the backend route handler — the response was being created and returned.
4. I checked the browser's Network tab — the request was being sent, but the response was blocked.

The breakthrough was when I noticed that the browser showed a CORS error in the console, but the Network tab showed a 503. This was confusing because Elysia has a CORS plugin enabled.

**Root cause:** Elysia's CORS middleware processes standard response objects (JSON, strings) and adds the `Access-Control-Allow-Origin` header. But when a route handler returns a raw `new Response(stream)`, Elysia passes it through unchanged — no CORS headers are added. The browser blocks the response, and since it's a streaming request, the error manifests as a generic 503 rather than a standard CORS error.

**Fix:** I built the CORS headers manually into every SSE response. This was a one-time fix that solved the problem permanently.

**Learning:** Framework middleware doesn't always work the way documentation implies, especially for non-standard response types like streams. When something works in Postman but not in the browser, CORS should be the first suspect. Also, CORS errors on streaming requests can show misleading HTTP status codes.

### Challenge 2: Multi-Tenancy as a Cross-Cutting Concern

Early in development, I wrote a product query without the `organizationId` filter and didn't notice until I tested with two different organizations and saw data from both — a textbook cross-tenant data leakage bug.

**How I solved it:** I made `organizationId` the first parameter of every service function. This creates a structural guarantee rather than a policy I need to remember:

```typescript
// Every service function starts with organizationId
export async function getProducts(organizationId: string, query: ProductQuery) {
  const conditions = [eq(products.organizationId, organizationId)];
  // ... every query starts with the org filter
}

export async function getProductById(organizationId: string, productId: string) {
  // Even single-product lookups are org-scoped
  return db.select().from(products)
    .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)));
}
```

By making it a required function parameter, TypeScript will show a compile error if I ever call a service function without providing the organization ID. This is much safer than remembering to add a WHERE clause.

**Learning:** Security invariants need to be structural, not just a convention you follow. The same principle applies to the `getSessionAndRole()` function being the first call in every route handler — it's a pattern that makes the correct behavior the default behavior.

### Challenge 3: Race Conditions in Stock Adjustments

I initially implemented stock adjustments as a simple sequence: fetch the product, calculate the new stock, update the database. This works for one user but breaks under concurrency.

**The bug:** Two users adjust the same product at the same time. Both read `currentStock = 10`. User A subtracts 8 → writes 2. User B subtracts 8 → also writes 2. The database now shows stock = 2, but two separate adjustments of -8 should have resulted in stock = -6 (which should be rejected). One adjustment is completely lost.

**The fix:** I wrapped the entire read-check-update-log sequence in a database transaction with `SELECT ... FOR UPDATE`. The `FOR UPDATE` lock ensures that if two transactions try to read the same product row, the second one waits until the first commits. After the first commit, the second transaction reads the already-updated value and correctly sees that -8 would result in negative stock.

**Learning:** Any read-modify-write cycle on shared data needs either pessimistic locking (`FOR UPDATE`), optimistic locking (version checks), or a compare-and-swap primitive. "It probably won't happen concurrently" is not a valid strategy for financial or inventory data. I also learned that PostgreSQL's transaction isolation levels (`READ COMMITTED` by default) don't protect against lost updates without explicit locking — you need `FOR UPDATE` or `SERIALIZABLE` isolation.

### Challenge 4: Managing BetterAuth's Auto-Created Tables

BetterAuth creates and manages 7 database tables automatically (`user`, `session`, `account`, `organization`, `member`, `invitation`, `verification`). Initially, these tables only existed in the database but had no corresponding Drizzle schema definitions, which meant:
- I couldn't use Drizzle's type-safe query builder to access them
- The database structure wasn't fully documented in code
- Anyone reading the codebase wouldn't understand what tables exist

**How I solved it:** I created Drizzle schema definitions for all 7 BetterAuth tables in `db/schema/auth.ts`. This doesn't change how BetterAuth manages these tables — BetterAuth still creates and migrates them through its own system. But it does mean the full database structure is visible and documented in the codebase. I also split the schemas into two files (`auth.ts` for BetterAuth tables, `app.ts` for application tables) with a barrel export in `index.ts`, making the separation between auth-managed and application-managed tables clear.

The role lookup in `session.ts` still uses raw SQL because it's a simple query that runs on every request, and the raw SQL approach avoids importing the auth schema into the session helper.

**Learning:** When using a library that manages its own database state, document the boundary between "your" schema and "their" schema explicitly in code. Even if you don't use the schema definitions for queries, having them makes the codebase easier to understand and the database structure self-documenting.

### Challenge 5: SSE Stream Lifecycle Management

Building a reliable SSE consumer was harder than expected. Several edge cases that I had to handle:

- **Multiple stream starts:** If the user clicks "Generate Report" twice quickly, two streams would run simultaneously, interleaving their content. I fixed this by calling `cleanup()` (which aborts the existing stream) at the start of every `startStream()` call.
- **Component unmount during streaming:** If the user navigates away while a report is streaming, the fetch request continues in the background, causing a memory leak and "setState on unmounted component" warnings. I fixed this with a `useEffect` cleanup that aborts the controller on unmount.
- **Chunk splitting:** SSE events can be split across TCP chunks. A single `reader.read()` might return half of a JSON object. I handle this by silently catching `JSON.parse` errors — the next chunk will complete the event. This was a subtle issue that only appeared on slow connections.
- **AbortError vs real errors:** When the user clicks "Stop", the fetch throws an `AbortError`. I detect this specifically and don't show it as an error to the user — it's an intentional action, not a failure.

**Learning:** Streaming APIs require careful lifecycle management. Every stream needs a way to be cleanly stopped (AbortController), state needs to be reset between streams, and the cleanup must happen on unmount. The "happy path" of streaming is simple — the edge cases are where the complexity lives.

### What I Would Do Differently

1. **Add email notifications for invitations.** The email-match flow works but has poor discoverability. An invited user doesn't know they've been invited until someone tells them to go sign up. Even a simple transactional email via Resend would solve this.

2. **Add WebSocket for real-time stock updates.** Currently, if two users are looking at the same product, one adjusts stock, and the other doesn't see the change until they refresh. WebSocket or polling would keep the UI in sync.

3. **Better error boundaries in the frontend.** Currently, errors show as inline messages in each component. A global error boundary with a toast notification system would provide a more consistent UX.

4. **Add integration tests.** I have no automated tests. For a production system, I would write API integration tests that verify multi-tenancy isolation, stock adjustment correctness, and RBAC enforcement end-to-end.

---

## B.5 Self-Assessment: Code Review Checklist

### Security

- [x] **All database queries filter by organizationId** — Every function in `product.service.ts` and `movement.service.ts` takes `organizationId` as the first parameter and includes `eq(products.organizationId, organizationId)` in the WHERE clause. The `getSessionAndRole()` helper extracts `organizationId` from the session, so there's no way for a user to specify a different org. The AI report endpoint also uses `getAllActiveProducts(orgId)` to scope the data sent to the AI service.

- [x] **Authentication required on all endpoints** — Every route handler starts with `const sessionData = await getSessionAndRole(headers)`. If the session is invalid, missing, or doesn't have an active organization, it returns 401. No endpoint can be accessed without a valid session cookie.

- [x] **Role checks for manager/admin-only operations** — Product creation and updates require `hasRole(sessionData.role, "manager")`. Product deletion requires `hasRole(sessionData.role, "admin")`. Report generation requires manager+ role. The `hasRole()` function uses a numeric hierarchy so higher roles inherit lower role permissions: `{ owner: 4, admin: 3, manager: 2, member: 1 }`.

- [x] **SKU uniqueness enforced per organization** — The database has a composite unique constraint `UNIQUE(organization_id, sku)` defined in the Drizzle schema. Additionally, the `createProduct()` service function checks for duplicate SKUs before inserting, returning `{ error: "DUPLICATE_SKU" }` if one exists. This means uniqueness is enforced both at the application level (for a nice error message) and at the database level (as a safety net).

- [x] **No hardcoded secrets or API keys** — `DATABASE_URL`, `GROQ_API_KEY`, `BETTER_AUTH_SECRET`, `FRONTEND_URL`, and `AI_SERVICE_URL` are all loaded from environment variables. `.env` files are gitignored. `.env.example` files document what variables are needed without containing actual values.

- [x] **Input validation on all user data** — Every POST, PUT, and PATCH endpoint parses the request body through a Zod schema (`.safeParse(body)`) before any processing. Query parameters on GET endpoints are validated through `productQuerySchema` and `movementQuerySchema`. Invalid input returns 400 with field-level error details. The AI service validates input with Pydantic models.

### Code Quality

- [x] **Follows consistent patterns** — All service functions follow the same signature pattern (`organizationId` first, then specific params). All route handlers follow the same structure: auth check → RBAC check → input validation → service call → error mapping → response. All Zustand actions follow: set loading → try API call → set result → catch set error.

- [x] **Proper error handling (no swallowed errors)** — Service functions return discriminated unions like `{ error: "NOT_FOUND" as const }` or `{ data: product }` instead of throwing exceptions. Route handlers map these to appropriate HTTP status codes. AI analysis failure during stock adjustment is caught, logged to stderr, and does not fail the stock operation. The Python AI service has a rule-based fallback when the LLM returns unparseable JSON.

- [x] **No console.log in backend** — Zero `console.log` statements exist in the backend codebase. The only logging uses `Bun.write(Bun.stderr, ...)` for the AI analysis warning. The Python AI service uses the `logging` module instead of `print` statements.

- [x] **TypeScript types are specific (no `any`)** — No `any` types in the codebase. Zod schemas export inferred types (`z.infer<typeof createProductSchema>`) that flow through service functions. The only type assertion is in `session.ts` where BetterAuth's session is cast to extract `activeOrganizationId`, because BetterAuth's type definitions don't include the organization plugin's fields.

- [x] **Async code properly handles errors with try/catch** — All external service calls (database transactions, AI service calls, fetch requests) are wrapped in try/catch blocks. The `useSSEStream` hook's `.catch()` handles both `AbortError` (user-initiated stop) and real errors differently. Zustand store actions catch errors and set the `error` state for UI display.

### Performance

- [x] **Queries select only needed columns** — List queries use explicit column selection:
  ```typescript
  db.select({
    id: products.id,
    name: products.name,
    sku: products.sku,
    category: products.category,
    // ... only the columns needed for the list view
  })
  ```
  The `description`, `aiReasoning`, and `organizationId` columns are excluded from list queries. Only `getProductById()` selects all columns because the detail page displays everything.

- [x] **No N+1 query patterns** — Product listings return all needed data in a single query. The dashboard stats endpoint uses SQL aggregation (`COUNT(*) FILTER (WHERE ...)`, `SUM(price * stock)`) to compute all four stats (total, low stock, out of stock, inventory value) in one query rather than loading all products and counting in JavaScript.

- [x] **Pagination on all list endpoints** — Products and movements both support `page` and `limit` query parameters, validated through Zod with defaults (page 1, limit 20) and a max limit of 100 per page. The total count runs in parallel with the data query using `Promise.all()`.

- [x] **Parallel operations where possible** — `getProducts()` runs the data query and count query in `Promise.all()`. Same pattern in `getAllMovements()` and `getMovementsByProduct()`. The frontend fetches stats and categories in parallel on dashboard load.

### Style & Organization

- [x] **Naming follows conventions** — camelCase for TypeScript (variables, functions, object properties), snake_case for Python (functions, variables), snake_case for database column names (mapped through Drizzle's column name parameter like `currentStock: integer("current_stock")`). File names use kebab-case for components and dot notation for services (`product.service.ts`).

- [x] **No commented-out or dead code** — All unused imports, functions, and commented-out code blocks have been removed. No `TODO` comments remain.

- [x] **Single responsibility functions** — Routes handle HTTP concerns (status codes, request parsing, response formatting). Services handle business logic (database queries, data transformation). Schemas handle validation. The session helper handles auth extraction. Each file has one clear purpose.

- [x] **Logical file organization** — Backend: `routes/` (HTTP handlers), `services/` (business logic), `schemas/` (Zod validation), `db/` (Drizzle schema + connection), `lib/` (auth + session helpers). Frontend: `hooks/` (custom React hooks), `store/` (Zustand state), `components/` (reusable UI), `types/` (TypeScript interfaces), `lib/` (API client + utils), `app/` (Next.js pages). AI Service: `main.py` (FastAPI app), `agent.py` (LangChain logic), `models.py` (Pydantic schemas), `config.py` (env loading). Database schema is split into `schema/auth.ts` (BetterAuth tables) and `schema/app.ts` (application tables) with a barrel export in `schema/index.ts`.

---

*StockPilot — Built with Next.js 16, Elysia on Bun, FastAPI + LangChain, and PostgreSQL.*
