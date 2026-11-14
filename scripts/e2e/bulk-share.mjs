// Bulk sharing: the batch bar's Share panel, the /account "share existing
// items" panel (including Stop sharing), and that both touch only the caller's
// own recipes — even for an admin.

import { BASE_URL, check, createGroup, createRecipe, pageFor, prisma, seedUser } from "./lib.mjs";

export async function bulkShare(browser) {
  const adminUser = await seedUser("admin", { admin: true });
  const admin = await pageFor(browser, adminUser, { width: 1280, height: 1200 });
  const other = await pageFor(browser, await seedUser("other"));

  await createRecipe(other, "E2e zyx other public", { isPublic: true });
  await createGroup(admin, "E2e bulkfam");
  await createRecipe(admin, "E2e zyx mine one", { untickGroups: ["E2e bulkfam"] });
  await createRecipe(admin, "E2e zyx mine two", { untickGroups: ["E2e bulkfam"] });

  // Batch bar: share a selection with the group; the other user's is skipped.
  await admin.goto(`${BASE_URL}/recipes?q=zyx`);
  await admin.getByRole("button", { name: "Select", exact: true }).click();
  for (const title of ["E2e zyx mine one", "E2e zyx mine two", "E2e zyx other public"]) {
    await admin.getByRole("button", { name: `Select ${title}`, exact: true }).click();
  }
  await admin.getByRole("button", { name: "Share", exact: true }).click();
  await admin
    .locator("li", { hasText: "E2e bulkfam" })
    .getByRole("button", { name: "Share", exact: true })
    .click();
  await admin.getByText("Shared 2 recipes with E2e bulkfam · 1 skipped (not yours)").waitFor();
  check(true, "batch share: own recipes shared, other's skipped even as admin");

  for (const title of ["E2e zyx mine one", "E2e zyx other public"]) {
    await admin.getByRole("button", { name: `Select ${title}`, exact: true }).click();
  }
  await admin.getByRole("button", { name: "Share", exact: true }).click();
  await admin.locator("li", { hasText: "Everyone" }).getByRole("button", { name: "Make public" }).click();
  await admin.getByText("Made 1 recipe public · 1 skipped (not yours)").waitFor();
  check(true, "batch make public");

  // Done -> Select starts clean (no stale panel, nothing selected).
  await admin.getByRole("button", { name: "Select E2e zyx mine two", exact: true }).click();
  await admin.getByRole("button", { name: "Share", exact: true }).click();
  await admin.getByRole("button", { name: "Done" }).click();
  await admin.getByRole("button", { name: "Select", exact: true }).click();
  check(!(await admin.getByRole("button", { name: "Make public" }).isVisible()), "re-entering selection closes panels");

  // /account panel reflects the batch result, and Stop sharing undoes it.
  await admin.goto(`${BASE_URL}/account`);
  const row = admin
    .locator("section", { hasText: "Share existing items" })
    .locator("li", { hasText: "E2e bulkfam" });
  check(await row.getByRole("button", { name: "No recipes left to share" }).isVisible(), "panel counts the batch-shared recipes");
  await row.getByRole("button", { name: "Stop sharing 2 recipes" }).click();
  await row.getByText("Stopped sharing 2 recipes.").waitFor();
  await admin.waitForTimeout(800);
  check(await row.getByRole("button", { name: "Share 2 recipes" }).isVisible(), "Stop sharing resets the counts");

  const otherShares = await prisma.recipeGroupShare.count({
    where: { recipe: { title: "E2e zyx other public" } },
  });
  check(otherShares === 0, "the other user's recipe was never shared");
}
