# StockPilot

Multi-tenant, AI-powered inventory management system with role-based access control and real-time stock analysis.

## Architecture

```
Frontend (Next.js) <--REST/SSE--> Backend (Elysia) <--REST/SSE--> AI Service (FastAPI) <--API--> Groq LLM
                                        |
                                   PostgreSQL
```

## Key Features

- **Multi-tenant inventory** -- organization-scoped data isolation
- **RBAC** -- Owner > Admin > Manager > Member role hierarchy
- **Auto-generated SKU** -- category prefix + sequence number
- **AI stock analysis** -- single-product insights and org-wide procurement reports
- **SSE streaming** -- real-time AI report delivery
- **Email-match invitations** -- users join orgs via email-based invite system
- **Initial stock tracking** -- set starting quantities at product creation

## Prerequisites

- [Bun](https://bun.sh) 1.x
- [Python](https://python.org) 3.10+
- [PostgreSQL](https://postgresql.org) 14+

## Project Structure

```
backend/       Elysia + Drizzle ORM + BetterAuth (Bun, port 3001)
frontend/      Next.js 16 + React 19 + Zustand + Tailwind v4 (Bun, port 3000)
ai-service/    FastAPI + LangChain + Groq (Python, port 8000)
```

## Environment Variables

Create a `.env` file in each service directory.

### backend/.env

```env
DATABASE_URL=postgresql://user:password@localhost:5432/stockpilot
BETTER_AUTH_SECRET=your-random-secret-here
FRONTEND_URL=http://localhost:3000
AI_SERVICE_URL=http://localhost:8000
```

### frontend/.env

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### ai-service/.env

```env
GROQ_API_KEY=your-api-key-from-console.groq.com
```

## Setup

### 1. Database

```bash
createdb stockpilot
```

### 2. Backend

```bash
cd backend
bun install
bun run db:push    # apply schema to database
bun run dev        # starts on port 3001
```

### 3. Frontend

```bash
cd frontend
bun install
bun run dev        # starts on port 3000
```

### 4. AI Service

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

## Usage

1. Sign up and create an organization.
2. Invite team members by email -- they will be matched to your org on signup.
3. Add products with category, quantity, and other details. SKUs are generated automatically.
4. Use the AI analysis feature to get stock insights for individual products or generate a full procurement report for your organization.

## Scripts Reference

| Command | Location | Description |
|---|---|---|
| `bun run dev` | backend | Start backend in watch mode |
| `bun run db:push` | backend | Push schema changes to database |
| `bun run db:studio` | backend | Open Drizzle Studio (DB GUI) |
| `bun run dev` | frontend | Start Next.js dev server |
| `bun run build` | frontend | Production build |
