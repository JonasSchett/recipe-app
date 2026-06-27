-- CreateTable
CREATE TABLE "RecipeImage" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RecipeImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeImage_recipeId_idx" ON "RecipeImage"("recipeId");

-- AddForeignKey
ALTER TABLE "RecipeImage" ADD CONSTRAINT "RecipeImage_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate each recipe's existing single image into the new gallery as the hero
-- (position 0) before dropping the old column, so no images are lost.
INSERT INTO "RecipeImage" ("id", "recipeId", "path", "position")
SELECT gen_random_uuid()::text, "id", "imagePath", 0
FROM "Recipe"
WHERE "imagePath" IS NOT NULL;

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "imagePath";
