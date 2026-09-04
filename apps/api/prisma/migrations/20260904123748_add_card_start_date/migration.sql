-- Adds an optional start date to cards (companion to the existing dueDate).
-- Hand-trimmed: `migrate dev` also emitted spurious ALTERs against the
-- generated `searchVector` column (see 20260901133553_add_fulltext_search),
-- which Postgres rejects — only the new column belongs in this migration.
ALTER TABLE "Card" ADD COLUMN "startDate" TIMESTAMP(3);
