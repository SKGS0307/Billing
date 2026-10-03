# Database design

## Phase 1 physical schema

Identity is normalized as `users`, `roles`, `permissions`, `user_roles`, and `role_permissions`. `sessions` holds only token hashes and supports expiry/revocation. `audit_logs` is append-only at the application layer. `settings` stores typed configuration values. All identifiers are UUIDs and all timestamps are PostgreSQL `timestamptz`.

Important constraints and indexes:

- case-insensitive canonical email is unique;
- role name and permission code are unique;
- composite primary keys prevent duplicate role grants;
- session token hash is unique; user and expiry indexes support authentication and cleanup;
- audit entity/time and actor/time indexes support investigations;
- inactive users and roles are rejected by authorization.

## Planned domain schema

Phase migrations will add categories, brands, products, product variants, suppliers, customers, sales and items, sale returns and items, purchases and items, purchase returns and items, payments, expenses, stock movements, stock adjustments, customer and supplier ledgers, cash sessions, coupons, tax rates, invoice sequences, exchanges and price history.

Every product variant owns its stock identity, SKU and barcode. Financial columns use `numeric(19,4)` and Node calculations use Prisma Decimal; display rounds at currency boundaries. Sale/purchase lines preserve names, variant labels, cost, price, discount and tax snapshots.

## Relationships

- Product -> many variants; category/brand -> many products.
- Variant -> many immutable stock movements; adjustments reference their movements.
- Sale/purchase -> many items and payments.
- Return -> original transaction and many return items linked to original lines.
- Customer/supplier -> immutable ledger entries tied to source transactions.
- Cash session -> cash payments, refunds, expenses and cash movements.
- User -> authored business records and audit events.

## Transaction and concurrency rules

Sale, return, purchase, purchase return, exchange, financial payment, stock adjustment and cash-close services each use one database transaction. Stock-affecting services lock variant rows (`SELECT ... FOR UPDATE`) in stable ID order and then insert matching movements. Invoice sequences use a row per fiscal/calendar key updated atomically inside the transaction; numbers are never reused. Critical creates persist a unique idempotency key and return the original committed result on retry.

Historical financial records transition status and are not deleted. Corrections use compensating entries.

## Phase 2 physical schema

`categories` and `brands` classify `products`; a product owns one or more `product_variants`. SKU and non-null barcode values are globally unique. Each variant stores its own prices, status, current stock cache and minimum stock threshold. Database checks reject negative stock, thresholds and prices.

`stock_movements` is the immutable inventory ledger and records the signed quantity plus resulting balance. `stock_adjustments` records the operator, reason and notes for manual changes and has a one-to-one movement. Opening stock is recorded through the same adjustment/movement mechanism inside product creation. `price_history` snapshots every prior and resulting variant price set.

Adjustment transactions lock the variant row with `SELECT ... FOR UPDATE`, validate the resulting stock, update the cached balance, add the adjustment and movement, and write the audit event before committing. A failed negative-stock check writes nothing.
