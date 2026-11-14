// Seed a multi-user scenario for manual or curl-based permission checks:
// an owner, a member and an outsider, a family group (owner + member), and a
// live session cookie for each — no browser or sign-in form needed.
//
//   npm run seed:test-users            # (re)create, print cookies
//   npm run seed:test-users -- --clean # delete everything e2e-marked
//
// Everything is e2e-marked (see scripts/e2e/lib.mjs), so it never touches real
// data and `--clean` (or an `npm run e2e`) removes it.

import { BASE_URL, cleanup, prisma, seedUser } from "./e2e/lib.mjs";

try {
  await cleanup();
  if (process.argv.includes("--clean")) {
    console.log("Removed all e2e test data.");
  } else {
    const owner = await seedUser("owner");
    const member = await seedUser("member");
    const outsider = await seedUser("outsider");
    const admin = await seedUser("admin", { admin: true });

    const group = await prisma.familyGroup.create({
      data: {
        name: "E2e family",
        ownerId: owner.id,
        members: { create: [{ userId: owner.id }, { userId: member.id }] },
      },
    });

    console.log(`Group "${group.name}": ${BASE_URL}/groups/${group.id}\n`);
    for (const [label, user] of Object.entries({ owner, member, outsider, admin })) {
      console.log(`${label.padEnd(8)} ${user.email.padEnd(24)} id=${user.id}`);
      console.log(`         curl -s -H 'Cookie: ${user.cookie}' ${BASE_URL}/groups\n`);
    }
    console.log("In a browser, sign in with the dev form as any of these emails.");
    console.log("Remove it all with: npm run seed:test-users -- --clean");
  }
} finally {
  await prisma.$disconnect();
}
