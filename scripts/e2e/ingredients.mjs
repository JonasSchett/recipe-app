// The ingredient editor (entry row + list) on the recipe form and in the batch
// bar's "Add ingredients" panel.

import { BASE_URL, check, isRecipePage, pageFor, seedUser, textOf } from "./lib.mjs";

export async function ingredients(browser) {
  const page = await pageFor(browser, await seedUser("cook"));

  await page.goto(`${BASE_URL}/groups`);
  check(await page.locator('input[placeholder="Group Name"]').isVisible(), "group name placeholder");

  await page.goto(`${BASE_URL}/recipes/new`);
  await page.fill("#title", "E2e qwv bread");
  const qty = page.getByLabel("Ingredient quantity");
  const unit = page.getByLabel("Ingredient unit");
  const name = page.getByLabel("Ingredient name");
  // Escape before Enter dismisses the autocomplete, so Enter means "add".
  const enterName = async (value) => {
    await name.fill(value);
    await name.press("Escape");
    await name.press("Enter");
  };

  check((await qty.isVisible()) && (await name.isVisible()), "entry row is open from the start");
  await qty.fill("200");
  await qty.press("Enter");
  check(page.url().endsWith("/recipes/new"), "Enter in qty doesn't submit the form");
  check(await unit.evaluate((el) => el === document.activeElement), "Enter in qty moves to unit");
  await unit.fill("g");
  await enterName("E2eflour");
  await page.getByRole("button", { name: "Edit E2eflour" }).waitFor();
  check((await qty.inputValue()) === "" && (await name.inputValue()) === "", "entry row clears after adding");

  await name.fill("E2eegg");
  await name.press("Escape");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await page.getByRole("button", { name: "Edit E2eegg" }).waitFor();

  await enterName("e2eflour");
  check(await page.getByText("e2eflour is already in the list.").isVisible(), "duplicate refused");
  await qty.fill("-1");
  await enterName("E2esugar");
  check(await page.getByText("Ingredient quantities must be positive numbers.").isVisible(), "non-positive quantity refused");
  await qty.fill("");
  await name.fill("");

  await page.getByRole("button", { name: "Edit E2eflour" }).click();
  check((await name.inputValue()) === "E2eflour" && (await qty.inputValue()) === "200", "Edit loads the line into the entry row");
  await qty.fill("300");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const lines = await page
    .locator("ul li", { has: page.getByRole("button", { name: /^Edit / }) })
    .allInnerTexts();
  check(lines[0]?.includes("300 g") && lines[0]?.includes("E2eflour") && lines[1]?.includes("E2eegg"), "edited line keeps its position");

  // Typed but never added: still saved.
  await name.fill("E2esalt");
  await name.press("Escape");
  await page.getByRole("button", { name: "Create recipe" }).click();
  await page.waitForURL(isRecipePage);
  const saved = await textOf(page);
  check(["300 g", "E2eflour", "E2eegg", "E2esalt"].every((s) => saved.includes(s)), "saves every line, incl. the half-typed one");
  const recipeUrl = page.url();

  // Batch bar panel uses the same editor, and applies a half-typed entry too.
  await page.goto(`${BASE_URL}/recipes?q=qwv`);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select E2e qwv bread", exact: true }).click();
  await page.getByRole("button", { name: "Add ingredients" }).click();
  const batchName = page.getByLabel("Batch ingredient name");
  await batchName.fill("E2epepper");
  await batchName.press("Escape");
  await page.getByRole("button", { name: "Apply to 1 recipe" }).click();
  await page.getByText("Added to 1 recipe").waitFor();
  await page.goto(recipeUrl);
  check((await textOf(page)).includes("E2epepper"), "batch panel applies a half-typed ingredient");
}
