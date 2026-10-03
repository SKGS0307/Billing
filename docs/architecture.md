# Architecture

## Decision record

The Trends Mart is an npm-workspaces monorepo with a React/TypeScript/Vite browser application and an Express/TypeScript REST API. PostgreSQL is the only system of record. Prisma is the sole ORM. In production, Express serves the built frontend; during development Vite and the API run separately.

The initial deployment is one shop computer, but bind addresses and browser/API origins are environment-driven for later LAN use. Core billing will not call internet services.

## Boundaries

- `frontend/src`: routes, pages, components, features, hooks, services, state, schemas, types, utilities, constants, tests.
- `backend/src/modules`: domain-oriented controllers, services, repositories, validation, routes, and tests.
- `backend/src/config`: validated environment and shared infrastructure.
- `backend/src/middleware`: authentication, authorization, errors, and request concerns.
- `backend/prisma`: PostgreSQL schema, migrations, and development seed.
- `database`, `docs`, `scripts`, `storage`: operations and durable local files.

Controllers translate HTTP only. Services own business decisions and transaction boundaries. Repositories own Prisma queries. Zod validates every untrusted API payload. API errors use a stable `{ success, error }` envelope.

## Phase plan

1. Foundation: authentication, RBAC, app shell, logging, errors, tests.
2. Product catalogue and inventory ledger.
3. Transactional POS and sales.
4. Invoice layouts, printing, PDF and WhatsApp hand-off.
5. Parties and immutable ledgers.
6. Purchases, returns and exchanges.
7. Expenses and cash sessions.
8. Reports and dashboard.
9. Barcode, import/export and backup.
10. Production hardening.

No later-phase UI is represented by non-functional controls in Phase 1.

## Security decisions

Passwords use bcrypt with cost 12. Login creates a random 256-bit opaque session token; only its SHA-256 hash is stored. The browser receives it in an HttpOnly, SameSite=Strict cookie. Logout/revocation deletes the session. Authorization evaluates active role permissions on every protected request. Helmet, strict CORS, body-size limits, login rate limiting and structured redacted logs are enabled.

CSRF risk is reduced by SameSite=Strict cookies and exact-origin CORS. State-changing endpoints also reject cross-site origins. Production must enable secure cookies behind HTTPS.

## Production topology

`Browser -> Express /api -> Prisma -> PostgreSQL`. Express serves `frontend/dist` for non-API routes. Development uses `http://localhost:5173` and proxies/API CORS to `http://localhost:4000`.
