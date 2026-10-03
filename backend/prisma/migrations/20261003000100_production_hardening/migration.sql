-- A user may operate only one open/reopened cash drawer at a time.
CREATE UNIQUE INDEX "cash_sessions_one_open_per_user"
ON "cash_sessions" ("opened_by_id")
WHERE "status" IN ('OPEN', 'REOPENED');
