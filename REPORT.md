# StockPilot - Written Report

**Multi-Tenant AI-Powered Inventory Management System**

---

## B.1 Architecture Overview

StockPilot is built as a three-service architecture where each service has a clear responsibility and communicates over REST (with one SSE exception for streaming).

**Frontend** -- Next.js 16 with React 19, Zustand for state management, and Tailwind CSS v4 for styling. Runs on port 3000. The frontend handles all user interaction, authentication flows, and real-time display of AI-generated procurement reports via a custom SSE hook. Zustand was chosen over Redux because the state needs are relatively simple -- product lists, auth state, sidebar toggles -- and Zustand's minimal boilerplate made it a better fit.

**Backend** -- An Elysia 1.4.28 server running on Bun (port 3001). This is the core of the application. It handles authentication through BetterAuth, enforces RBAC on every route, manages all database operations through Drizzle ORM, and acts as a proxy between the frontend and the AI service. Every database query is scoped by `organizationId` to enforce tenant isolation. Zod schemas validate all incoming request bodies and query parameters before they reach any service layer.

**AI Service** -- A FastAPI server (port 8000) that wraps LangChain with the Groq API, using the `llama-3.3-70b-versatile` model. It exposes two endpoints: `/analyze` for single-product stock analysis (returns JSON), and `/generate-report` for procurement reports (returns an SSE stream). The AI service has no concept of users or organizations -- it simply receives product data and returns analysis. All access control happens in the backend before data reaches this service.

**Database** -- PostgreSQL with two sets of tables. The first set is defined in Drizzle schema (`products`, `stock_movements`) and managed through Drizzle ORM migrations. The second set (`user`, `session`, `account`, `organization`, `member`, `invitation`) is auto-created and managed by BetterAuth. This split means some queries (like fetching a member's role) have to use raw SQL since Drizzle doesn't have schema definitions for BetterAuth's tables.

**Data flow for a typical request:**
1. Frontend sends request with session cookie
2. Backend extracts session via BetterAuth, looks up `activeOrganizationId` and the user's role from the `member` table
3. If auth + RBAC pass, the service layer executes org-scoped database operations
4. Response returns to the frontend, Zustand store updates, UI re-renders

---

## B.2 Key Design Decisions

### Decision 1: BetterAuth with the Organization Plugin

I chose BetterAuth over NextAuth or a custom JWT system for authentication and multi-tenancy. The organization plugin was the deciding factor -- it handles user registration, login, sessions, organization creation, member management, and invitations out of the box. NextAuth doesn't support organizations at all, and building a custom JWT system with org management from scratch would have taken days.

The tradeoff is that BetterAuth auto-creates its own database tables (`user`, `session`, `member`, etc.) outside of Drizzle's schema management. This means when I need to query something like a user's role within an organization, I have to use raw SQL:

```typescript
const result = await db.execute(
  sql`SELECT role FROM member WHERE "organizationId" = ${orgId} AND "userId" = ${userId} LIMIT 1`
);
```

This is slightly awkward, but the reduction in auth boilerplate was worth it. I estimate BetterAuth saved around 80% of the code I would have written for auth + organization management.

### Decision 2: Email-Match Invitation Flow

Instead of the typical token-based invitation system (generate a token, send a link, user clicks link to join), I implemented an email-match approach. An admin adds a user's email and desired role to the invitation list. When someone signs up with that email, the system detects the pending invitation and the user can accept it to join the organization.

The main advantage is UX simplicity. There are no invitation tokens to share, no expiring links, no "click this link" step. The admin just says "I want user@example.com to be a manager" and when that person signs up, it works. The downside is that the invited user has to know to go sign up -- there's no email notification telling them about the invitation (that would require an email service, which was out of scope).

### Decision 3: SELECT FOR UPDATE for Stock Adjustments

Stock adjustments are the most critical write operation in the system. If two users adjust the same product's stock at the same time, without proper locking you could end up with a lost update or negative stock. I solved this with a PostgreSQL transaction using `SELECT ... FOR UPDATE`:

```typescript
const txResult = await db.transaction(async (tx) => {
  const [product] = await tx
    .select()
    .from(products)
    .where(and(eq(products.id, params.id), eq(products.organizationId, orgId)))
    .for("update");

  if (!product) return { error: "NOT_FOUND" as const };
  const newStock = product.currentStock + parsed.data.quantity;
  if (newStock < 0) return { error: "NEGATIVE_STOCK" as const };

  // update stock + create movement record inside same transaction
});
```

The `.for("update")` lock ensures that if two requests hit the same product row simultaneously, the second one waits until the first transaction commits. This guarantees the stock value is always consistent and the movement audit trail is accurate. I considered optimistic locking (checking a version number) but `FOR UPDATE` is simpler to reason about and PostgreSQL handles it efficiently.

### Decision 4: Auto-Generated SKU with Category Prefix

SKUs are generated automatically using the first three characters of the category (or product name if no category) plus a zero-padded sequence number. For example, a product in "Electronics" gets `ELE-001`, the next one gets `ELE-002`. A unique constraint `(organizationId, sku)` prevents duplicates at the database level.

I considered requiring manual SKU input, but that leads to inconsistency and user errors. UUIDs would be unique but not human-readable -- you can't glance at `ELE-003` and `STA-007` on a shelf label and know what category they belong to. The auto-generation also handles edge cases like sequence gaps (if products are deleted) by falling back to a `MAX()` query on existing sequence numbers.

### Decision 5: SSE via Manual Response Headers (Not Elysia Middleware)

This was the hardest technical problem in the project. The procurement report streams from the AI service as SSE, and the backend needs to proxy that stream to the frontend. The problem: Elysia's CORS middleware does **not** add CORS headers to raw `Response` objects. So when I returned a `new Response(stream)`, the browser blocked it with a CORS error, which manifested as a cryptic 503.

The fix was to build the CORS headers manually into every SSE response:

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

The backend also re-emits the AI service's stream through its own `ReadableStream` to ensure Bun fully controls the streaming lifecycle. This was necessary because directly passing through the fetch response body caused intermittent connection drops.

### Decision 6: fetch-Based SSE Hook Instead of EventSource

On the frontend, I wrote a custom `useSSEStream` hook that uses `fetch` with `ReadableStream` instead of the browser's built-in `EventSource` API. The reason is straightforward: `EventSource` does not support sending cookies or credentials with requests. Since the assignment requires cookie-based authentication (BetterAuth sessions), `EventSource` simply cannot work -- the backend would see an unauthenticated request.

The `fetch` approach also gives better control over aborting streams (via `AbortController`), parsing SSE data manually, and handling different HTTP error codes with specific error messages. The hook manages its own lifecycle, cleaning up the `AbortController` on component unmount to prevent memory leaks.

---

## B.3 AI Usage Log

I want to be transparent about how I used AI assistance during development.

**What Claude Code helped with:**
- Initial project scaffolding -- generating the folder structure, `package.json` configs, and boilerplate setup files for all three services
- TailwindCSS styling -- layout classes, responsive design patterns, component styling
- TypeScript type definitions -- interfaces for API responses, props types for components
- Debugging the SSE 503 error -- after I spent time investigating, Claude helped identify that Elysia strips CORS from raw Response objects
- Architecture planning -- discussing the tradeoffs between different auth libraries and invitation approaches
- Drizzle ORM query patterns -- the `filter(where ...)` syntax for aggregated stats was unfamiliar to me

**What I wrote by hand (as required by the assignment):**
- All Zod validation schemas (`validation.ts`) -- the product, stock adjustment, query parameter, and invitation schemas with their specific constraints and error messages
- The Zustand stores (`auth.store.ts`, `inventory.store.ts`, `sidebar.store.ts`) -- state shape, actions, and selector patterns
- The `useSSEStream` hook -- the entire fetch-based SSE consumption logic including chunk parsing, abort handling, error mapping, and cleanup
- Multi-tenancy filtering -- ensuring `organizationId` appears in every `where` clause across all service functions
- Auth and RBAC guard logic -- the `getSessionAndRole` helper and `hasRole` function with the role hierarchy
- LangChain prompt engineering -- both the analysis prompt (with structured JSON output rules) and the procurement report prompt (with the exact section structure and formatting rules)
- Error handling patterns -- the `{ error: "DUPLICATE_SKU" as const }` discriminated union pattern for type-safe error handling in service functions

**How I used AI suggestions:**
Every piece of AI-generated code was reviewed and adapted. For example, Claude initially suggested using Elysia's built-in CORS plugin for SSE -- I had to reject that and write the manual headers approach after testing showed it didn't work. The architecture discussion helped me think through options, but the final decisions were mine based on the actual constraints of the assignment.

---

## B.4 Challenges & Learnings

### Challenge 1: The SSE 503 Mystery

The most frustrating bug was the procurement report returning a 503 error. The AI service was running fine, the backend could fetch from it directly, but the frontend always got a 503. After hours of debugging, I traced it to Elysia's CORS handling. When a route handler returns a standard object, Elysia wraps it and adds CORS headers. But when you return a raw `Response` object (necessary for streaming), Elysia passes it through untouched -- no CORS headers get added.

The browser saw a response without `Access-Control-Allow-Origin` and blocked it. But because it was a streaming request, the error manifested as a generic 503 rather than a clear CORS error in the network tab.

**Learning:** Framework middleware doesn't always behave the way documentation implies, especially for non-standard response types like streams. When something works in Postman but not in the browser, CORS should be the first suspect.

### Challenge 2: Multi-Tenancy is a Cross-Cutting Concern

Ensuring every single database query filters by `organizationId` is surprisingly easy to forget. Early in development, I wrote a product query without the org filter and didn't notice until I tested with two different organizations and saw cross-tenant data leakage.

I addressed this by making `organizationId` the first parameter of every service function. This creates a pattern that's hard to accidentally skip:

```typescript
export async function getProducts(organizationId: string, query: ProductQuery) {
  const conditions = [eq(products.organizationId, organizationId)];
  // ...
}
```

**Learning:** Security invariants need to be structural, not just a policy you remember to follow. By making `organizationId` a required function parameter rather than something you add to a query, the TypeScript compiler catches any omission.

### Challenge 3: Race Conditions in Stock Adjustments

I initially implemented stock adjustments as a simple read-then-write: fetch the current stock, calculate the new value, update. This works fine for a single user but falls apart under concurrent access. Two users could both read stock as 10, both subtract 8, and the final stock would be 2 instead of the correct -6 (which should be rejected).

The `SELECT FOR UPDATE` approach serializes concurrent writes to the same product row. The tradeoff is slightly higher latency for concurrent requests to the same product, but in a realistic inventory system this is rare and the correctness guarantee is worth it.

**Learning:** Any read-modify-write cycle on shared state needs either pessimistic locking (like `FOR UPDATE`), optimistic locking (version checks), or a compare-and-swap primitive. "It probably won't happen concurrently" is not a valid strategy for financial/inventory data.

### Challenge 4: BetterAuth's Auto-Managed Tables

BetterAuth creates and manages its own database tables (`user`, `session`, `member`, `organization`, `invitation`). These tables don't exist in my Drizzle schema, so I can't use Drizzle's type-safe query builder to access them. For example, to get a user's role in an organization, I need raw SQL.

This created a split in the codebase: product and movement queries use Drizzle's typed API, while auth-related queries use `db.execute(sql\`...\`)` with manual type assertions. It's not ideal, but defining Drizzle schemas for BetterAuth's tables would be fragile -- any BetterAuth update could change the table structure.

**Learning:** When using a library that manages its own database state, accept the boundary between "your" schema and "their" schema rather than trying to unify everything. The raw SQL queries are isolated to the session helper, so the blast radius is contained.

### Challenge 5: Designing the Invitation Flow

Token-based invitations are the industry standard, but they require either an email service (to send the token link) or a manual copy-paste step (which is poor UX). Since setting up an email service was out of scope, I designed the email-match approach instead.

The challenge was making sure the flow felt intuitive. An admin adds an email, a user signs up with that email, and they see a pending invitation to accept. No extra steps, no tokens, no links. The downside is discoverability -- an invited user doesn't know they've been invited unless someone tells them to go sign up.

**Learning:** Sometimes the "standard" approach isn't the best one for your specific constraints. The email-match flow is simpler to implement, simpler to use, and avoids the entire token lifecycle management problem. It wouldn't work at scale (you'd want email notifications), but for this assignment's scope it's the right choice.

---

## B.5 Self-Assessment: Code Review Checklist

### Security

- [x] **All database queries filter by organizationId** -- Every function in `product.service.ts` and `movement.service.ts` takes `organizationId` as the first parameter and includes it in the WHERE clause. No cross-tenant data access is possible.
- [x] **Authentication on all endpoints** -- Every route handler calls `getSessionAndRole(headers)` and returns 401 if the session is invalid.
- [x] **RBAC enforced** -- Role checks use `hasRole(sessionData.role, requiredRole)` with a numeric hierarchy (owner:4 > admin:3 > manager:2 > member:1). Product creation requires manager+, deletion requires admin+, report generation requires manager+.
- [x] **SKU uniqueness per organization** -- A composite unique constraint `(organizationId, sku)` at the database level prevents duplicate SKUs within an organization, enforced by both a pre-check in application code and the DB constraint as a safety net.
- [x] **No hardcoded secrets** -- All sensitive values (database URL, Groq API key, BetterAuth secret) are loaded from environment variables.
- [x] **Input validation on all endpoints** -- Every POST, PUT, PATCH endpoint parses the request body through a Zod schema before processing. Query parameters are also validated through schemas.

### Code Quality

- [x] **Follows consistent patterns** -- All service functions follow the same signature pattern (`organizationId` first), all routes follow the same auth-validate-execute-respond structure.
- [x] **Proper error handling** -- Service functions return discriminated unions like `{ error: "NOT_FOUND" }` or `{ data: product }` instead of throwing exceptions. AI failures during stock adjustment are caught and logged without failing the stock operation itself.
- [x] **TypeScript types are specific** -- No `any` types in the codebase. Zod schemas export inferred types (`z.infer<typeof createProductSchema>`) that flow through the entire request lifecycle.
- [x] **Async operations use try/catch** -- All external service calls (AI service, database transactions) are wrapped in try/catch blocks with appropriate error responses.
- [x] **No console.log in production code** -- Zero `console.log` statements exist in both backend and frontend source code. The Python AI service uses proper `logging` module instead of `print` statements.

### Performance

- [x] **Queries select only needed columns** -- List queries (product list, movement list, active products for AI report) use explicit column selection via `db.select({ id: products.id, name: products.name, ... })` to avoid fetching unnecessary data like `description`, `aiReasoning`, or `organizationId`. The only query that uses `select()` (all columns) is `getProductById()`, which intentionally loads every field since the product detail page displays all information including description, AI analysis, and timestamps.
- [x] **Pagination on all list endpoints** -- Products and movements both support `page` and `limit` query parameters, validated through Zod with sensible defaults (page 1, limit 20, max 100).
- [x] **Parallel operations where possible** -- The `getProducts` function runs the data query and count query in `Promise.all()` rather than sequentially. Same pattern in `getAllMovements` and `getMovementsByProduct`.
- [x] **No N+1 queries** -- Product listings return all needed data in a single query. The stats endpoint uses SQL aggregation (`COUNT`, `SUM`, `FILTER`) to compute dashboard stats in one query rather than loading all products and counting in JavaScript.

### Style & Organization

- [x] **Consistent naming conventions** -- camelCase for TypeScript (variables, functions, properties), snake_case for Python (AI service), snake_case for database columns (mapped through Drizzle's column name parameter).
- [x] **No dead code** -- Unused imports and functions have been removed. No commented-out code blocks remain.
- [x] **Single responsibility** -- Services handle business logic, routes handle HTTP concerns (status codes, request parsing), schemas handle validation, and the session helper handles auth extraction. Each file has one job.
- [x] **Logical file organization** -- Backend is split into `routes/`, `services/`, `schemas/`, `db/`, and `lib/` directories. Frontend separates `hooks/`, `store/`, `components/`, and `types/`. AI service separates `main.py` (FastAPI app), `agent.py` (LangChain logic), `models.py` (Pydantic schemas), and `config.py` (environment loading).

---

*StockPilot -- Built with Next.js 16, Elysia on Bun, FastAPI + LangChain, and PostgreSQL.*
