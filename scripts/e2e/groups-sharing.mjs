// Family groups: invites, group-shared recipes and notes, removal, join link,
// sharing defaults, notes placement, and PUBLIC notes on a public recipe.

import {
  BASE_URL,
  check,
  createGroup,
  createRecipe,
  pageFor,
  seedUser,
  signInViaForm,
  testEmail,
  textOf,
} from "./lib.mjs";

export async function groupsSharing(browser) {
  const owner = await pageFor(browser, await seedUser("owner"));
  const member = await pageFor(browser, await seedUser("member"));
  const outsider = await pageFor(browser, await seedUser("outsider"));

  // Owner creates a group; invites an existing user and a not-yet-user.
  const groupUrl = await createGroup(owner, "E2e family");
  const invite = owner.locator('input[aria-label="Email or username to invite"]');
  await invite.fill(testEmail("member"));
  await owner.getByRole("button", { name: "Invite", exact: true }).click();
  await owner.getByText("is now in the group").waitFor();
  await invite.fill(testEmail("future"));
  await owner.getByRole("button", { name: "Invite", exact: true }).click();
  await owner.getByText("Joins on first sign-in").waitFor();
  check(true, "owner invites an existing user and a pending one");

  await member.goto(groupUrl);
  const memberView = await textOf(member);
  check(memberView.includes("Leave group"), "member sees the group");
  check(!memberView.includes(testEmail("future")), "member doesn't see pending invites");
  await outsider.goto(groupUrl);
  check(!(await textOf(outsider)).includes("E2e family"), "outsider can't see the group");

  // Per-group defaults pre-tick the create form and a new note.
  await owner.goto(`${BASE_URL}/account`);
  const defaults = owner.locator("li", { hasText: "E2e family" }).first();
  await defaults.getByLabel("Share my new recipes with this group").check();
  await owner.waitForTimeout(600);
  await defaults.getByLabel("Share my new notes with this group").check();
  await owner.waitForTimeout(600);

  await owner.goto(`${BASE_URL}/recipes/new`);
  check(await owner.getByLabel("E2e family", { exact: true }).isChecked(), "create form pre-ticks the group");
  await owner.fill("#title", "E2e wolfsbane stew");
  await owner.fill("#description", "DESCRIPTIONMARK hearty");
  await owner.getByRole("button", { name: "Create recipe" }).click();
  await owner.waitForURL((url) => url.pathname !== "/recipes/new" && url.pathname.startsWith("/recipes/"));
  const recipeUrl = owner.url();
  check((await textOf(owner)).includes("Shared with E2e family"), "recipe page names the group");

  await owner.getByRole("button", { name: "Add a note" }).click();
  check(await owner.getByLabel("E2e family", { exact: true }).isChecked(), "new note pre-ticks the group");
  await owner.fill('textarea[aria-label="Note"]', "quicksilver tip");
  await owner.getByRole("button", { name: "Save note" }).click();
  await owner.getByRole("button", { name: "Edit note" }).waitFor();
  await owner.goto(recipeUrl);
  const ownerView = await textOf(owner);
  const note = ownerView.indexOf("quicksilver");
  check(
    note > ownerView.indexOf("E2e wolfsbane") && note < ownerView.indexOf("DESCRIPTIONMARK"),
    "note sits between the title and the description",
  );

  // Members read the private recipe and the shared note; outsiders don't.
  await member.goto(recipeUrl);
  const memberRecipe = await textOf(member);
  check(memberRecipe.includes("E2e wolfsbane") && memberRecipe.includes("quicksilver tip"), "member sees private recipe + shared note");
  await outsider.goto(recipeUrl);
  check(!(await textOf(outsider)).includes("E2e wolfsbane"), "outsider can't see the group recipe");

  // A member's own note stays private unless they choose otherwise.
  await member.getByRole("button", { name: "Add a note" }).click();
  check(!(await member.getByLabel("E2e family", { exact: true }).isChecked()), "member's note starts private (no defaults)");
  await member.fill('textarea[aria-label="Note"]', "nightshade secret");
  await member.getByRole("button", { name: "Save note" }).click();
  await member.getByRole("button", { name: "Edit note" }).waitFor();
  await owner.goto(recipeUrl);
  check(!(await textOf(owner)).includes("nightshade"), "a private note doesn't reach the owner");

  // Removal revokes access.
  await owner.goto(groupUrl);
  await owner.getByRole("button", { name: /^Remove e2e-member/ }).click();
  await owner.waitForTimeout(800);
  await member.goto(recipeUrl);
  check(!(await textOf(member)).includes("E2e wolfsbane"), "removed member loses access");

  // The pending invite is consumed at sign-in (needs the real sign-in path).
  const future = await signInViaForm(browser, "future");
  await future.goto(groupUrl);
  check((await textOf(future)).includes("E2e family"), "pending invite consumed at sign-in");
  await future.goto(recipeUrl);
  check((await textOf(future)).includes("quicksilver tip"), "new member sees shared recipe + note");

  // Join link.
  await owner.goto(groupUrl);
  await owner.getByRole("button", { name: "Create invite link" }).click();
  const link = await owner.locator('input[aria-label="Invite link"]').inputValue();
  await outsider.goto(link);
  await outsider.getByRole("button", { name: "Join the group" }).click();
  await outsider.waitForURL(groupUrl);
  check((await textOf(outsider)).includes("E2e family"), "join link adds a member");

  // A PUBLIC note on a public recipe reaches someone outside every group.
  const stranger = await pageFor(browser, await seedUser("stranger"));
  const pieUrl = await createRecipe(owner, "E2e saffron pie", { isPublic: true });
  await owner.getByRole("button", { name: "Add a note" }).click();
  await owner.getByLabel("E2e family", { exact: true }).uncheck();
  await owner.getByLabel("Share with everyone who can see this recipe").check();
  await owner.fill('textarea[aria-label="Note"]', "real saffron threads");
  await owner.getByRole("button", { name: "Save note" }).click();
  await owner.getByText("Shared with everyone who can see this recipe").waitFor();
  await stranger.goto(pieUrl);
  const strangerView = await textOf(stranger);
  check(strangerView.includes("real saffron threads"), "PUBLIC note visible to a non-member");
  check(!strangerView.includes("E2e family"), "non-member doesn't learn group names");
}
