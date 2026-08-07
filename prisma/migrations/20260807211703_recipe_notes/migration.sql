-- CreateTable
CREATE TABLE "RecipeNote" (
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeNote_pkey" PRIMARY KEY ("recipeId","userId")
);

-- CreateIndex
CREATE INDEX "RecipeNote_userId_idx" ON "RecipeNote"("userId");

-- AddForeignKey
ALTER TABLE "RecipeNote" ADD CONSTRAINT "RecipeNote_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeNote" ADD CONSTRAINT "RecipeNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
