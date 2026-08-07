-- Extensions backing the fuzzy recipe search in `src/lib/recipe-search.ts`.
--
--   pg_trgm  — trigram similarity (`word_similarity`, the `<%` operator), which
--              is what makes the search tolerate typos.
--   unaccent — diacritic stripping, so the folded comparison keys match the
--              ones `src/lib/suggest.ts` builds for the autocomplete.
--
-- Prisma does not manage extensions, so these are hand-written. Both ship with
-- the postgres image and the compose DB user owns the database, so this
-- succeeds under `prisma migrate deploy` in production too.
--
-- No indexes: the search compares *folded* expressions of the text columns, so
-- a trigram index on the raw columns could never serve it. At household scale
-- the scan is negligible. If it ever isn't, the fix is a stored folded column
-- (maintained on write) with a GIN trigram index on it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
