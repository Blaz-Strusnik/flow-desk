-- Full-text search columns. Not representable in schema.prisma (Prisma has
-- no tsvector type), so this migration is hand-written rather than
-- generated. Scoped to Card(title, description) and Message(body) per the
-- build plan.

ALTER TABLE "Card" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "Card_searchVector_idx" ON "Card" USING GIN ("searchVector");

ALTER TABLE "Message" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("body", ''))) STORED;

CREATE INDEX "Message_searchVector_idx" ON "Message" USING GIN ("searchVector");
