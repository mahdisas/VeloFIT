# FITX — Gym Management SaaS

Enterprise-grade, multi-tenant gym management platform: clients, subscriptions,
classes & calendar, attendance, finance and more.

## Tech stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **UI:** Tailwind CSS v4, Shadcn UI (Radix), Lucide icons, Recharts
- **Backend:** Supabase — PostgreSQL, Auth, Row Level Security for tenant isolation

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project keys
npm run dev                  # http://localhost:3000
```

The dashboard currently renders mock data (`src/lib/mock-data.ts`) shaped like
the real queries, so it works without a Supabase project.

## Database

Schema lives in [`supabase/migrations/00001_initial_schema.sql`](supabase/migrations/00001_initial_schema.sql).

- Apply with the Supabase CLI: `supabase db push` (or paste into the SQL editor).
- Dev data: `supabase/seed.sql` creates the demo **Nation Gym** tenant
  (trainers, class kinds, weekly slots, clients, plans).
- Generate TypeScript types after schema changes:
  `supabase gen types typescript --linked > src/lib/database.types.ts`

### Multi-tenancy model

`gyms` is the tenant table; every business row carries a `gym_id`. Staff log in
through Supabase Auth and their `profiles` row pins them to one gym. RLS on
every table enforces `gym_id = auth_gym_id()`, so tenants are isolated at the
database layer — not just in application code.

## Project layout

```
supabase/                 SQL migrations + seed data
src/app/(app)/            authenticated routes (shared sidebar/topbar shell)
src/components/layout/    app shell: sidebar, topbar, brand
src/components/dashboard/ metric cards + Recharts widgets
src/components/ui/        Shadcn UI primitives
src/lib/                  navigation config, supabase clients, mock data
```

## Roadmap

- [x] Multi-tenant schema with RLS
- [x] App shell (collapsible sidebar, topbar, mobile nav)
- [x] Dashboard (metrics, hourly forecast, revenue, subscription mix)
- [ ] Auth (sign-in, gym onboarding, staff invites)
- [ ] Classes calendar (week grid, color-coded class cards, booking)
- [ ] Clients module (profiles, subscriptions, check-ins)
- [ ] Finance (invoices, receipts, debits)
