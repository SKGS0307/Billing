# Business rules

- PostgreSQL is authoritative for identity, permissions, prices, tax, stock and accounting.
- The API recalculates all financial totals; browser totals are estimates only.
- Money uses decimal arithmetic, never binary floating-point arithmetic.
- Every stock change has exactly one documented source and immutable movement record.
- Variant stock cannot fall below zero; sale-time stock is checked under a row lock.
- Completed financial documents are never physically deleted or rewritten.
- Invoice numbers are unique, atomic and never reused after cancellation.
- Returns cannot exceed sold quantity less prior completed returns.
- Tax and cost snapshots make historical invoices and profit stable.
- Permissions are enforced server-side. Admin, Manager and Cashier receive least-privilege defaults.
- User lockout and password-change requirements are enforced during authentication.
- Business dates display as `DD/MM/YYYY` in `Asia/Kolkata`; storage uses timezone-aware timestamps.
- Currency is INR and normal UI uses the `₹` symbol.
- Product codes and SKUs are normalized to uppercase; SKU and barcode are globally unique.
- Every product has at least one independently stocked variant.
- Stock cannot be edited through product endpoints. Opening stock and manual corrections always create a signed movement.
- Damaged, lost and theft adjustments must reduce stock; found-stock adjustments must increase it.
- Variant price edits append price history and never rewrite that history.

## Phase 1 roles

Admin receives all foundation permissions. Manager receives dashboard access. Cashier receives dashboard/POS-entry permission in preparation for Phase 3. User administration requires `users:read` or `users:manage`; critical settings require `settings:manage`.
