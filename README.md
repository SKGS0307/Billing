# The Trends Mart

Production-oriented local-first POS, billing and inventory management for a clothing retailer in Bareilly, Uttar Pradesh. Phases 1–10 are implemented as real database-backed workflows.

## What Phase 1 includes

- React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod and accessible Radix UI primitives.
- Express 5 REST API with Prisma and PostgreSQL.
- Bcrypt password hashing; opaque random sessions stored only as SHA-256 hashes.
- HttpOnly/SameSite cookies, login throttling, account lockout, exact-origin CORS, mutation-origin checks and Helmet headers.
- Database-enforced users, roles, permissions, sessions, settings and audit logs.
- Seeded Admin, Manager and Cashier roles with least-privilege grants.
- Responsive black, white and gold login/app shell plus a real protected users view.
- Structured/redacted logs and consistent API error envelopes.

## What Phase 2 includes

- Categories, brands, products and independently stocked clothing variants.
- Unique product codes, normalized SKUs and unique barcodes.
- Purchase cost, MRP, retail and wholesale prices with price history.
- Opening stock and row-locked manual adjustments recorded in an immutable movement ledger.
- Low-stock/out-of-stock alerts, inventory search, filters and movement history.

## Phases 3–10

- Barcode-search POS, held bills, retail/wholesale pricing, discounts, inclusive/exclusive GST, mixed payments, credit sales, idempotent checkout and concurrency-safe stock deduction.
- A4, 80mm and 58mm invoice views with reprint, browser PDF, configurable store/footer/return policy, cancellation, returns and WhatsApp hand-off.
- Customer and supplier profiles, payments, outstanding balances and immutable ledgers.
- Purchases, sales returns, purchase returns and exchange links with atomic inventory, payment, tax, ledger and audit updates.
- Cash sessions, cash in/out, expenses and expected-versus-actual shift reconciliation.
- Live dashboard and sales, GST, profit, product-profit, inventory, expense, customer, supplier and return reports.
- Code 128 barcode generation/bulk printing, validated CSV product import, CSV exports and PostgreSQL backup/download/confirmed restore.
- Responsive role-gated UI, strict TypeScript, security controls, migrations, tests and production builds.

## Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 15+ or Docker/Podman Compose

## Quick start

1. Copy `.env.example` to `.env` if `.env` is absent.
2. Replace `AUTH_SECRET` and the seeded password. Keep `.env` private.
3. Start PostgreSQL: `docker compose up -d postgres`.
4. Install dependencies: `npm install`.
5. Apply schema: `npm run db:migrate`.
6. Seed foundation data: `npm run db:seed`.
7. Start both applications: `npm run dev`.
8. Open `http://localhost:5173`.

The bundled Docker service maps PostgreSQL to host port `5433` because port `5432` is commonly occupied. Adjust both `docker-compose.yml` and `DATABASE_URL` together if required.

The default development-only account is `admin@trendmart.local` / `ChangeMe123!`. It is marked as requiring a password change and must never be used as a permanent production credential.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start API and Vite development servers |
| `npm run build` | Generate Prisma client and build API/web production artifacts |
| `npm run lint` | Lint both workspaces |
| `npm run typecheck` | Strict TypeScript validation |
| `npm test` | Run unit, UI and API tests |
| `npm run db:migrate` | Apply committed migrations |
| `npm run db:seed` | Upsert development foundation data |

## Production and LAN deployment

Build with `npm run build`, set `NODE_ENV=production`, configure a strong `AUTH_SECRET`, set `COOKIE_SECURE=true` behind HTTPS, and start with `npm run start -w backend`. Express serves the built frontend and `/api` from one origin.

For development over the LAN, Vite binds to all interfaces and proxies `/api` to the local backend. Open the shop computer's LAN address on another device. Restrict access with the host firewall; never expose PostgreSQL itself to the LAN or internet.

## Database and credentials

Timestamps use `timestamptz`; display uses `Asia/Kolkata`. Foundation migrations are under `backend/prisma/migrations`. The `.env` file is ignored by Git. Rotate the development password and auth secret before using real store data.

## Backup and restore

Admins can create and download custom-format PostgreSQL backups from **Data & backups**. Restore requires typing the exact `RESTORE <filename>` confirmation. Test restores against a disposable database before relying on them; restore is destructive.

## Documentation

- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [Business rules](docs/business-rules.md)
- [API contract](docs/api-contract.md)
- [Implementation checklist](docs/implementation-checklist.md)

## Troubleshooting

- `P1001` from Prisma: confirm PostgreSQL is healthy and `DATABASE_URL` uses the mapped port.
- Browser login cannot reach API: confirm API port 4000 is running and use `/api` through Vite/production same-origin serving.
- Cookie rejected in production: serve through HTTPS and set `COOKIE_SECURE=true`.
- Migration state: run `npm run db:migrate`; do not edit a migration already applied to production.
