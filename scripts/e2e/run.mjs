// Browser smoke suites. `npm run e2e` runs all of them; `npm run e2e -- groups`
// runs the ones whose name contains "groups". Needs `npm run dev` up first.
//
// Each suite starts and ends with `cleanup()`, which deletes only e2e-marked
// rows (see lib.mjs), so it's safe against the live dev DB.

import { BASE_URL, cleanup, launch, prisma, summary } from "./lib.mjs";
import { groupsSharing } from "./groups-sharing.mjs";
import { bulkShare } from "./bulk-share.mjs";
import { ingredients } from "./ingredients.mjs";

const suites = { groupsSharing, bulkShare, ingredients };
const filter = process.argv[2]?.toLowerCase();
const selected = Object.entries(suites).filter(
  ([name]) => !filter || name.toLowerCase().includes(filter),
);

const up = await fetch(`${BASE_URL}/login`).then((r) => r.ok).catch(() => false);
if (!up) {
  console.error(`No app at ${BASE_URL} — start it with \`npm run dev\` first.`);
  process.exit(2);
}

const browser = await launch();
try {
  for (const [name, suite] of selected) {
    console.log(`\n== ${name}`);
    await cleanup();
    try {
      await suite(browser);
    } catch (error) {
      // A thrown error (usually a locator timeout) fails the suite, not the run.
      console.log(`FAIL ${name} aborted: ${error.message.split("\n")[0]}`);
      process.exitCode = 1;
    }
  }
} finally {
  await browser.close();
  await cleanup();
  await prisma.$disconnect();
}

if (!summary()) process.exitCode = 1;
