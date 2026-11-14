// Shared helpers for the browser smoke suites and the test-user seed script.
//
// Run through `npm run e2e` / `npm run seed:test-users`, which pass
// `--env-file=.env` so DATABASE_URL is set. Needs the dev server up
// (`npm run dev`) and Chrome at CHROME_PATH (default /usr/bin/google-chrome).
//
// Everything a suite creates is marked so cleanup can find it without touching
// the user's own data in the dev DB:
//   - users:          e2e-<role>@test.local
//   - recipes, tags,
//     ingredients:    names starting with "E2e" (tags and ingredients are
//                     GLOBAL rows — deleting a user does not remove them)

import { randomBytes } from "node:crypto";
import prismaPkg from "@prisma/client";
import { chromium } from "playwright-core";

const { PrismaClient } = prismaPkg;

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
export const prisma = new PrismaClient();

/** `e2e-owner@test.local` etc. — the only addresses cleanup deletes. */
export const testEmail = (role) => `e2e-${role}@test.local`;

// --- Reporting ---------------------------------------------------------------

let passed = 0;
let failed = 0;

/** Record one assertion. Failures don't throw, so a suite reports them all. */
export function check(condition, message) {
  if (condition) passed += 1;
  else failed += 1;
  console.log(`${condition ? "PASS" : "FAIL"} ${message}`);
}

export function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
  return failed === 0;
}

// --- Database ----------------------------------------------------------------

/**
 * Remove everything the suites create. Safe to run any time: it only matches
 * the e2e markers above. Order matters only for rows that don't cascade from
 * the user (groups and lists cascade from their owner; invites are by email).
 */
export async function cleanup() {
  const users = { email: { startsWith: "e2e-", endsWith: "@test.local" } };
  await prisma.familyGroupInvite.deleteMany({ where: { email: { startsWith: "e2e-" } } });
  await prisma.recipeListInvite.deleteMany({ where: { email: { startsWith: "e2e-" } } });
  await prisma.recipe.deleteMany({ where: { author: users } });
  await prisma.user.deleteMany({ where: users });
  await prisma.ingredient.deleteMany({
    where: { name: { startsWith: "e2e", mode: "insensitive" } },
  });
  await prisma.tag.deleteMany({
    where: { name: { startsWith: "e2e", mode: "insensitive" } },
  });
}

/**
 * Create (or reuse) a test user with a live session, without a browser.
 * Returns the cookie for `curl -H "Cookie: …"` and for Playwright contexts.
 * Mirrors `startSession`: a real Session row, cookie name for plain http.
 */
export async function seedUser(role, { admin = false } = {}) {
  const email = testEmail(role);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: admin ? "ADMIN" : "USER" },
    create: { email, name: `e2e-${role}`, role: admin ? "ADMIN" : "USER" },
  });
  const sessionToken = `e2e-${role}-${randomBytes(16).toString("hex")}`;
  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return { ...user, sessionToken, cookie: `authjs.session-token=${sessionToken}` };
}

// --- Browser -----------------------------------------------------------------

export async function launch() {
  return chromium.launch({ executablePath: CHROME_PATH });
}

/** Phone-sized by default — the app is mobile-first, and it's where layout bites. */
export const PHONE = { width: 390, height: 1400 };

/**
 * A signed-in page for `user` (from `seedUser`), via its session cookie — no
 * trip through the login form, so the dev sign-in's role upsert can't demote
 * anyone by accident.
 *
 * Also hides the Next.js dev badge ("N", bottom-left): at phone width it sits
 * on top of the batch bar's buttons and swallows clicks. It only exists under
 * `next dev`.
 */
export async function pageFor(browser, user, viewport = PHONE) {
  const context = await browser.newContext({ viewport });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: user.sessionToken,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  });
  const page = await context.newPage();
  // confirm() dialogs (delete, bulk share) — accept them.
  page.on("dialog", (dialog) => dialog.accept());
  return page;
}

/** Rendered text only. Never `page.content()`: it embeds stale RSC payloads. */
export const textOf = (page) => page.locator("body").innerText();

/**
 * URL predicate for "on a recipe detail page". A bare `/\/recipes\/[a-z0-9]+$/`
 * also matches `/recipes/new`, so `waitForURL` resolves instantly on the
 * create form and every later step runs against the wrong page.
 */
export const isRecipePage = (url) =>
  /^\/recipes\/[a-z0-9]+$/.test(url.pathname) && url.pathname !== "/recipes/new";

/** Create a recipe through the form and return its URL. */
export async function createRecipe(page, title, { isPublic = false, untickGroups = [] } = {}) {
  await page.goto(`${BASE_URL}/recipes/new`);
  await page.fill("#title", title);
  if (isPublic) await page.getByLabel("Make this recipe public").check();
  for (const group of untickGroups) await page.getByLabel(group, { exact: true }).uncheck();
  await page.getByRole("button", { name: "Create recipe" }).click();
  await page.waitForURL(isRecipePage);
  return page.url();
}

/** Create a family group through the UI and return its URL. */
export async function createGroup(page, name) {
  await page.goto(`${BASE_URL}/groups`);
  await page.fill('input[aria-label="New group name"]', name);
  await page.getByRole("button", { name: "New group" }).click();
  await page.waitForURL(/\/groups\/[a-z0-9]+$/);
  return page.url();
}

/**
 * Sign in through the dev form instead of a seeded cookie — needed when the
 * test is about what happens *at* sign-in (consuming pending list or group
 * invites). Always passes the role explicitly: the dev sign-in upserts it.
 */
export async function signInViaForm(browser, role, { admin = false } = {}) {
  const page = await pageFor(browser, { sessionToken: "none" });
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', testEmail(role));
  await page.selectOption('select[name="role"]', admin ? "ADMIN" : "USER");
  await page.locator('form:has(input[name="email"]) button').last().click();
  await page.waitForURL("**/recipes");
  return page;
}
