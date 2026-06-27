-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN     "displayName" TEXT;

-- AlterTable
ALTER TABLE "RecipeTag" ADD COLUMN     "displayName" TEXT;

-- CreateTable
CREATE TABLE "IngredientName" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL,

    CONSTRAINT "IngredientName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagName" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL,

    CONSTRAINT "TagName_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientName_normalized_key" ON "IngredientName"("normalized");

-- CreateIndex
CREATE INDEX "IngredientName_ingredientId_idx" ON "IngredientName"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "TagName_normalized_key" ON "TagName"("normalized");

-- CreateIndex
CREATE INDEX "TagName_tagId_idx" ON "TagName"("tagId");

-- AddForeignKey
ALTER TABLE "IngredientName" ADD CONSTRAINT "IngredientName_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagName" ADD CONSTRAINT "TagName_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: treat every existing ingredient/tag name as its English canonical
-- alias so lookups keep working immediately. `normalized` mirrors the app's
-- normalize (trim + collapse whitespace + lowercase). A later script can add
-- the German aliases via the dictionary. ON CONFLICT guards the rare case of
-- two names that normalize identically.
INSERT INTO "IngredientName" ("id", "ingredientId", "name", "normalized", "locale")
SELECT gen_random_uuid()::text, "id", "name",
       lower(btrim(regexp_replace("name", '\s+', ' ', 'g'))), 'en'
FROM "Ingredient"
ON CONFLICT ("normalized") DO NOTHING;

INSERT INTO "TagName" ("id", "tagId", "name", "normalized", "locale")
SELECT gen_random_uuid()::text, "id", "name",
       lower(btrim(regexp_replace("name", '\s+', ' ', 'g'))), 'en'
FROM "Tag"
ON CONFLICT ("normalized") DO NOTHING;
