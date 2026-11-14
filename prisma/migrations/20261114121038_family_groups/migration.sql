-- AlterTable
ALTER TABLE "RecipeNote" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultNoteVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "FamilyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shareRecipesByDefault" BOOLEAN NOT NULL DEFAULT false,
    "shareNotesByDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FamilyGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "FamilyGroupInvite" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyGroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeGroupShare" (
    "recipeId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeGroupShare_pkey" PRIMARY KEY ("recipeId","groupId")
);

-- CreateTable
CREATE TABLE "RecipeNoteGroupShare" (
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "RecipeNoteGroupShare_pkey" PRIMARY KEY ("recipeId","userId","groupId")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGroup_shareToken_key" ON "FamilyGroup"("shareToken");

-- CreateIndex
CREATE INDEX "FamilyGroup_ownerId_idx" ON "FamilyGroup"("ownerId");

-- CreateIndex
CREATE INDEX "FamilyGroupMember_userId_idx" ON "FamilyGroupMember"("userId");

-- CreateIndex
CREATE INDEX "FamilyGroupInvite_email_idx" ON "FamilyGroupInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGroupInvite_groupId_email_key" ON "FamilyGroupInvite"("groupId", "email");

-- CreateIndex
CREATE INDEX "RecipeGroupShare_groupId_idx" ON "RecipeGroupShare"("groupId");

-- CreateIndex
CREATE INDEX "RecipeNoteGroupShare_groupId_idx" ON "RecipeNoteGroupShare"("groupId");

-- AddForeignKey
ALTER TABLE "FamilyGroup" ADD CONSTRAINT "FamilyGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGroupMember" ADD CONSTRAINT "FamilyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGroupMember" ADD CONSTRAINT "FamilyGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGroupInvite" ADD CONSTRAINT "FamilyGroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeGroupShare" ADD CONSTRAINT "RecipeGroupShare_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeGroupShare" ADD CONSTRAINT "RecipeGroupShare_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeNoteGroupShare" ADD CONSTRAINT "RecipeNoteGroupShare_recipeId_userId_fkey" FOREIGN KEY ("recipeId", "userId") REFERENCES "RecipeNote"("recipeId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeNoteGroupShare" ADD CONSTRAINT "RecipeNoteGroupShare_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
