# REST API contract

Base URL: `/api`. JSON success responses are `{ "success": true, "data": ... }`. Errors are `{ "success": false, "error": { "code", "message", "details?" } }`. Stack traces are never returned in production.

## Foundation endpoints

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| GET | `/health` | none | Process/database readiness |
| POST | `/auth/login` | none, rate limited | Start an HttpOnly-cookie session |
| POST | `/auth/logout` | session | Revoke current session |
| GET | `/auth/me` | session | Current user, roles and permissions |
| PATCH | `/auth/password` | session | Verify and rotate own password |
| GET | `/users` | `users:read` | Paginated/searchable users |
| POST | `/users` | `users:manage` | Create a user with active roles |
| PATCH | `/users/:id` | `users:manage` | Change name, active status or roles |
| GET | `/roles` | `roles:read` | Active roles and permission codes |
| GET/POST | `/categories` | `products:read` / `products:manage` | List or create categories |
| PATCH | `/categories/:id` | `products:manage` | Edit or activate/deactivate a category |
| GET/POST | `/brands` | `products:read` / `products:manage` | List or create brands |
| PATCH | `/brands/:id` | `products:manage` | Edit or activate/deactivate a brand |
| GET/POST | `/products` | `products:read` / `products:manage` | Search/list or transactionally create products and variants |
| GET/PATCH | `/products/:id` | `products:read` / `products:manage` | Product details or status/metadata update |
| POST | `/products/:id/variants` | `products:manage` | Add a variant and optional opening stock movement |
| PATCH | `/products/:id/variants/:variantId` | `products:manage` | Edit variant metadata/prices without direct stock changes |
| GET | `/inventory` | `inventory:read` | Paginated variant balances and low/out counts |
| GET | `/inventory/movements` | `inventory:read` | Immutable stock movement history |
| POST | `/inventory/adjustments` | `inventory:adjust` | Row-locked documented stock adjustment |

Login accepts `{ "email": string, "password": string }`. The session cookie is never returned in JSON. Pagination uses `page`, `pageSize`, and optional `search`; lists include meta totals.

## Operational endpoints

| Domain | Routes |
|---|---|
| Sales/POS | `GET/POST /sales`, `GET /sales/:id`, `POST /sales/:id/cancel` |
| Returns | `GET/POST /sale-returns`, `POST /sale-returns/:id/exchange`, `GET/POST /purchase-returns` |
| Parties | CRUD/list `/customers`, `/suppliers`; `POST /:id/payments` |
| Procurement | `GET/POST /purchases`, `GET /purchases/:id` |
| Cash/expenses | `/cash-sessions`, `/expenses`, `/expenses/categories` |
| Reports | `/reports/dashboard`, `/reports/{sales,gst,profit,product-profit,stock,expenses,customers,suppliers,returns}` |
| Configuration | `/settings`, `/settings/tax-rates`, `/settings/coupons` |
| Data | `/data/imports/products/{preview,commit}`, `/data/exports/:entity` |
| Backup | `GET/POST /backups`, `GET /backups/:name/download`, `POST /backups/:name/restore` |
| Audit | `GET /audit-logs` |

`POST /sales` requires an `Idempotency-Key` header. Stock-changing operations use serializable transactions and row locks.
