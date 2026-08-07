-- CreateEnum
CREATE TYPE "ListRole" AS ENUM ('VIEWER', 'EDITOR');

-- CreateTable
CREATE TABLE "RecipeList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "shareToken" TEXT,
    "shareRole" "ListRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeListItem" (
    "listId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeListItem_pkey" PRIMARY KEY ("listId","recipeId")
);

-- CreateTable
CREATE TABLE "RecipeListMember" (
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ListRole" NOT NULL DEFAULT 'EDITOR',

    CONSTRAINT "RecipeListMember_pkey" PRIMARY KEY ("listId","userId")
);

-- CreateTable
CREATE TABLE "RecipeListInvite" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ListRole" NOT NULL DEFAULT 'EDITOR',
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeListInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeList_shareToken_key" ON "RecipeList"("shareToken");

-- CreateIndex
CREATE INDEX "RecipeList_ownerId_idx" ON "RecipeList"("ownerId");

-- CreateIndex
CREATE INDEX "RecipeListItem_recipeId_idx" ON "RecipeListItem"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeListMember_userId_idx" ON "RecipeListMember"("userId");

-- CreateIndex
CREATE INDEX "RecipeListInvite_email_idx" ON "RecipeListInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeListInvite_listId_email_key" ON "RecipeListInvite"("listId", "email");

-- AddForeignKey
ALTER TABLE "RecipeList" ADD CONSTRAINT "RecipeList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeListItem" ADD CONSTRAINT "RecipeListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "RecipeList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeListItem" ADD CONSTRAINT "RecipeListItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeListMember" ADD CONSTRAINT "RecipeListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "RecipeList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeListMember" ADD CONSTRAINT "RecipeListMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeListInvite" ADD CONSTRAINT "RecipeListInvite_listId_fkey" FOREIGN KEY ("listId") REFERENCES "RecipeList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
