# Implementation checklist

## Phase 0

- [x] Inspect repository (empty at start)
- [x] Select npm workspaces, React/Vite, Express and Prisma
- [x] Define architecture, database relationships and transaction boundaries
- [x] Define API response and foundation contracts
- [x] Create required directory structure

## Phase 1

- [x] Validated environment configuration
- [x] PostgreSQL/Prisma schema and initial migration
- [x] Users, roles, permissions, sessions and seed
- [x] Password hashing, secure opaque cookie sessions, login/logout/me
- [x] Server-side authorization middleware
- [x] Structured logging, security headers, CORS and consistent errors
- [x] React login, protected routes, responsive app shell and user list
- [x] Backend and frontend tests
- [x] Apply migration and seed against a local PostgreSQL 17 acceptance instance
- [x] Exercise database health, login, session authentication and Admin protected access
- [x] Verify seeded Admin/Manager/Cashier permission grants in PostgreSQL
- [x] Exercise Admin user creation, Manager denial, and required password rotation
- [ ] Replace development credentials/secrets and validate HTTPS deployment

Phase 1 acceptance passed on the local deployment database.

## Phase 2

- [x] Categories and brands with activation controls
- [x] Products with archived/inactive status instead of deletion
- [x] Independent size/colour variants
- [x] Unique normalized SKU and unique barcode enforcement
- [x] Decimal purchase, MRP, retail and wholesale pricing
- [x] Opening stock ledger entries
- [x] Row-locked stock adjustments with reasons and audit logs
- [x] Low-stock and out-of-stock queries and UI
- [x] Immutable movement history and price history
- [x] Search by product, code, category, brand, SKU and barcode
- [x] Backend/frontend validation, permissions and responsive screens
- [x] PostgreSQL migration and runtime acceptance

## Phases 3–10

- [x] POS, barcode search, cart, discounts, GST, mixed payments, credit, held bills and idempotent sale completion
- [x] Sequential invoices, stock deduction, historical snapshots and audited cancellation
- [x] A4/80mm/58mm print, reprint, browser PDF, configurable invoice text and WhatsApp hand-off
- [x] Customers, suppliers, payments, ledgers and outstanding balances
- [x] Purchases, sale returns, purchase returns, refunds and exchanges
- [x] Expenses, cash sessions, movements and drawer reconciliation
- [x] Live dashboard and sales/GST/profit/product/inventory/customer/supplier/expense/return reporting
- [x] Code 128 barcode printing, validated CSV import and CSV exports
- [x] PostgreSQL backup, download and explicit-confirmation restore workflow
- [x] Strict TypeScript, lint, unit/API/UI tests, production build and live PostgreSQL acceptance

Acceptance exercised the complete stock-changing chain and removed all temporary test records afterward.
