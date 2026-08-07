# Plan v2 — Feature Round 2

Design for six requested features. Written to be implemented one at a time, one
commit per feature (or per underlying requirement). See `PLAN.md` for the
original spec and `CLAUDE.md` for conventions this plan follows.

Requested:

1. Multi-select recipes → batch add tags / ingredients
2. Search over instruction text
3. Per-user Notes on any recipe
4. User settings on the profile page (4.1: default visibility for new recipes)
5. Create / share / collaborate on pinned recipe lists (weekly meal planning)
6. Camera capture when adding images / a recipe from the phone

---

## 0. Cross-cutting design

Four things tie these features together. Getting them right once keeps each
feature small.

**0.1 — `visibilityWhere` stays the single read choke point.** Today it is
`PUBLIC OR mine`. Feature 5 adds a third grant path (a recipe pinned to a list
I'm a member of). Because every read query already funnels through
`visibilityWhere(user)` in `queries.ts`, that's a one-function change — no query
audit needed. Writes stay on `assertCanModifyRecipe` (owner or admin);
**list membership never grants write access to a recipe.**

**0.2 — One selection mechanism, several actions.** Feature 1 needs multi-select
over recipe cards. Feature 5 wants "add these 6 recipes to next week's list".
Build selection *once* as a client context around `RecipeBrowser`, with a
pluggable action bar. Feature 1 ships it with two actions (add tags, add
ingredients); feature 5 adds a third (add to list) for free.

**0.3 — Settings is the home for future per-user preferences.** Feature 4 builds
the page + the read path; 4.1 is its first tenant. Notes and lists both have
plausible future settings (e.g. "include my notes in search", "default list"),
so the shape matters more than the one field.

**0.4 — Search is one `OR` block.** Feature 2 adds `instructions`. Feature 3
extends the same block with the current user's own notes. Both land in
`getRecipes` in `queries.ts`.

Schema additions across the whole round: 1 column on `User`, 1 new note model,
3 new list models. Four migrations total (features 1, 2 and 6 need none).

---

## 1. Batch select → batch add tags / ingredients

### UI

`RecipeBrowser` gains a **Select** toggle next to the Filters button. In
selection mode:

- Each card shows a checkbox; clicking anywhere on the card toggles selection
  instead of navigating.
- A sticky action bar appears at the bottom (`fixed` on mobile, inline on
  desktop): `N selected · Add tags · Add ingredients · Select page · Clear`.
- "Add tags" opens a panel with the existing `EntityAutocomplete` (tag
  vocabulary already loaded by `RecipeBrowser`) + chips + **Apply**.
- "Add ingredients" is the same with quantity/unit fields per row, reusing the
  ingredient-row layout from `RecipeForm`.

### Components

- `src/components/recipe-selection.tsx` — client context provider
  (`Set<string>` of recipe ids) + `useSelection()`. Rendered by `RecipeBrowser`
  (server) wrapping its children, so selection **survives pagination**: the
  provider's element position is stable across same-route navigations.
- `src/components/selectable-card.tsx` — client wrapper that renders the
  server-rendered `<RecipeCard>` as `children` and overlays a click-capturing
  layer + checkbox when selection mode is on. **`RecipeCard` itself is not
  touched**, so it stays a plain server component everywhere else.
- `src/components/batch-action-bar.tsx` — the sticky bar and its panels.

### Server

`src/lib/actions/batch.ts`:

```ts
addTagsToRecipes(recipeIds: string[], tagNames: string[])
addIngredientsToRecipes(recipeIds: string[], ingredients: IngredientInput[])
```

Both: `requireUser` → load the recipes' `{id, authorId}` → **partition into
modifiable and skipped** (owner or admin) → in one transaction resolve the
entities once via the existing `resolveTags` / `resolveIngredients` → write join
rows with `createMany({ skipDuplicates: true })` (the composite PKs make
re-tagging a no-op). Returns `{ updated, skipped }` so the bar can report
"Added to 5 recipes · 2 skipped (not yours)". Validation in `validations.ts`:
`batchTagInputSchema` / `batchIngredientInputSchema`, max 200 recipe ids.

Resolving entities *once* rather than per recipe matters — `resolveTags` does
several queries per name and creates alias rows.

### Notes

- Add-only in v1. Batch **remove** tag and batch **set visibility** are a natural
  follow-up commit (`deleteMany where recipeId in / tagId in`) — say the word and
  I'll fold them in.
- "Select all N matching the filter" (beyond the current page) would mean passing
  the filter to the action instead of ids. Deferred; "Select page" covers the
  common case at 20/page.

**Commits:** (a) selection context + selectable card + bar shell; (b) batch tag
action + panel; (c) batch ingredient action + panel.

---

## 2. Search over instruction text — **done** (`621a441`)

Grew past the intended one-liner: adding `instructions` to the existing
`contains` block was the easy half, but review raised fuzzy matching, which
`contains` cannot do at all. Built instead as `src/lib/recipe-search.ts`:

- **Prefilter architecture.** Raw SQL returns recipe ids ranked by relevance;
  `getRecipes` applies them as `id IN (…)`, so visibility, tag/ingredient
  filters and the typed includes are untouched. All the messy text matching is
  isolated in one module.
- **Folding, then trigrams.** Both sides are folded exactly as
  `lib/suggest.ts` folds for the autocomplete (both keys — plain and
  umlaut-expanded), so "suss", "suess" and "süß" all reach "süß". Trigram
  similarity on top absorbs typos. Folding is what handles umlauts: trigrams
  alone cannot, since "puree"/"püree" share too few triplets in a word that
  short.
- **Threshold 0.45**, chosen from measured pairs, not taste: real typos scored
  0.50–0.80, unrelated pairs ≤0.25. Postgres' 0.6 default sat on top of
  ordinary misspellings ("spagetti"/"spaghetti" = 0.58).
- **Relevance ordering** while searching (title beats description beats
  instructions), alphabetical without a search.
- **Migration** creates the `pg_trgm` and `unaccent` extensions. No indexes:
  the comparison is against folded expressions, which an index on the raw
  columns could never serve. A search is therefore one scan — negligible at
  household scale. If it ever isn't, materialize the folded text as a stored
  column maintained on write and put a GIN trigram index on that.

Feature 3 extends the same module with the user's own notes.

---

## 3. Per-user Notes

A note is a **private notepad, one per (user, recipe)** — not a comment thread.
You can note any recipe you can *see*, including someone else's.

### Schema

```prisma
model RecipeNote {
  recipeId  String
  userId    String
  body      String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([recipeId, userId])
  @@index([userId])
}
```

### Server

- `src/lib/actions/notes.ts`: `saveRecipeNote(recipeId, body)` (upsert; empty
  body deletes) and `deleteRecipeNote(recipeId)`. Guard is **view** permission,
  not modify: re-check the recipe against `visibilityWhere` before writing.
- `recipeDetailInclude` becomes `recipeDetailInclude(userId)` so it can include
  `notes: { where: { userId }, take: 1 }`. `RecipeDetail` is then
  `Prisma.RecipeGetPayload<{ include: ReturnType<typeof recipeDetailInclude> }>`.
  Small refactor, touches every query in `queries.ts` — worth it, because it
  makes "do I have a note on this?" free everywhere cards render.

### UI

- Recipe page: a **Notes** section below Instructions — textarea + Save, with a
  "Private to you" hint. Collapsed to an "Add a note" button when empty.
- `RecipeCard`: a small note icon when the current user has a note, so notes are
  discoverable from lists.
- Search: extend feature 2's `OR` with
  `{ notes: { some: { userId: user.id, body: { contains: search, mode: "insensitive" } } } }`.
  **Assumption:** searching your own notes is desirable and safe (scoped to
  `user.id`, so it can never leak someone else's). Easy to put behind a setting
  later if you'd rather it be opt-in.

**Commits:** (a) schema + migration + actions + recipe-page UI; (b) card
indicator + note-aware search.

---

## 4. User settings (4.1: default recipe visibility)

### Schema

A column on `User`, not a separate settings table:

```prisma
defaultRecipeVisibility Visibility @default(PRIVATE)
```

Rationale: the session uses the **database** strategy, so the `session()`
callback already receives the full DB user row — new columns are available with
zero extra queries, no join, and no "settings row missing" case to handle. Each
future setting is one more column.

### Server

- `getUserSettings()` in `queries.ts` (reads the current user's settings row).
- `src/lib/actions/settings.ts`: `updateUserSettings(input)` — `requireUser`,
  Zod-validated, writes only the current user's row.

### UI

`/account` gains a **Settings** card below the profile card: a toggle
"New recipes are public by default". Saves on change via a `useTransition`
client component (`src/components/user-settings-form.tsx`), same pattern as
`TagHeartButton`.

### Wiring 4.1

`/recipes/new` reads the setting and passes it into `RecipeForm`'s `initial`, so
the "Make this recipe public" checkbox starts pre-ticked. **The DB default and
the `recipeInputSchema` default stay `PRIVATE`** — this is a form pre-fill, not a
server-side fallback, so nothing can accidentally publish a recipe when the form
omits the field.

**Commit:** one (schema + migration + settings page + form wiring).

---

## 5. Pinned recipe lists (create / share / collaborate)

The largest feature. Built last so it can reuse selection (F1) and settle the
visibility question (0.1).

### Schema

```prisma
model RecipeList {
  id         String   @id @default(cuid())
  name       String
  ownerId    String
  shareToken String?  @unique   // set when link-sharing is enabled
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  owner   User               @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  items   RecipeListItem[]
  members RecipeListMember[]

  @@index([ownerId])
}

model RecipeListItem {
  listId    String
  recipeId  String
  position  Int
  addedById String
  addedAt   DateTime @default(now())

  @@id([listId, recipeId])
  @@index([recipeId])
}

enum ListRole { VIEWER, EDITOR }

model RecipeListMember {
  listId String
  userId String
  role   ListRole @default(EDITOR)

  @@id([listId, userId])
  @@index([userId])
}

// An email-share for someone who has no account yet. Consumed into a
// RecipeListMember row the first time that email signs in; see below.
model RecipeListInvite {
  id          String   @id @default(cuid())
  listId      String
  email       String   // stored lowercased
  role        ListRole @default(EDITOR)
  invitedById String
  createdAt   DateTime @default(now())

  list RecipeList @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@unique([listId, email])
  @@index([email])
}
```

### Access model

- **Owner:** everything, including rename, share, delete, membership.
- **EDITOR:** add/remove/reorder recipes.
- **VIEWER:** read only.
- `listAccessWhere(user)` = `owner OR member`, mirroring `visibilityWhere`.
- **Admins do not implicitly see everyone's lists.** Recipes are library content
  (admin-manages-all makes sense); lists are social objects between specific
  people. Flagging this as a deliberate inconsistency with the recipe model.

### Sharing mechanism — **both: secret link and by email** (decided)

**Link.** `shareToken` (a random URL-safe id) + a `/lists/join/[token]` page: any
signed-in user who opens it becomes a member at the role the owner chose. The
owner can revoke by rotating or clearing the token.

**By email.** `shareListWithEmail(listId, email, role)`:

- Normalize the address (trim + lowercase) and look the user up
  case-insensitively (`email: { equals, mode: "insensitive" }` — Google supplies
  whatever casing it likes).
- **User exists** → write the `RecipeListMember` row immediately. The list shows
  up under "Shared with me" the next time they load the app.
- **No account yet** → write a `RecipeListInvite` row instead.

Pending invites are consumed in the NextAuth **`signIn` event** in `auth.ts` —
the same hook the `AUTH_ADMIN_EMAILS` admin bootstrap already uses, which fires
after the user row exists. For each invite matching the new sign-in's email:
create the member row (`skipDuplicates` semantics via upsert), delete the invite.
Idempotent and self-healing, so a share sent before the person ever signed in
just works when they do.

The members panel lists real members and pending invites together, the latter
marked *"Pending — joins on first sign-in"*, with revoke on both. Note that
`AUTH_ALLOWED_EMAILS`, when set, still gates who can get an account at all — an
invite to an address outside that list will sit pending forever, so the share
form warns when the address isn't allowed.

### The visibility question — **recommended: the list grants read**

If a PRIVATE recipe is pinned to a shared list, members can view it. Otherwise a
shared meal plan shows holes, which defeats the feature.

`visibilityWhere` becomes:

```ts
{ OR: [
    { visibility: "PUBLIC" },
    { authorId: user.id },
    { listItems: { some: { list: {
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    } } } },
] }
```

Guardrails:
- The list page shows a banner when it contains private recipes and is shared:
  *"3 private recipes on this list are visible to its members."*
- The pin control warns when pinning a private recipe to a shared list.
- Grant is **read-only** — members can't edit or delete someone's recipe.
- Cost: one correlated subquery on every recipe read. Fine at this scale.

### Pages & UI

- `/lists` — "My lists" + "Shared with me", with recipe counts and a Create form.
- `/lists/[id]` — ordered recipe cards, remove + up/down reorder (same pattern as
  image ordering in `RecipeForm`), share panel (owner only), leave-list (members).
- **Nav:** a "Pinned Lists" entry in `Navbar`.
- **Dashboard:** the most recently updated accessible list renders as a section
  above the hearted-tag sections — that's the "recipes I plan to cook this week,
  one tap away" payoff.
- **Recipe page:** a **Pin** button opening a small popover of your lists +
  "New list…". Last-used list is remembered in `localStorage` (no schema needed).
- **Batch:** "Add to list" joins the F1 action bar.

### Server

`src/lib/actions/lists.ts`: `createList`, `renameList`, `deleteList`,
`addRecipesToList(listId, recipeIds[])`, `removeRecipeFromList`,
`moveListItem(listId, recipeId, direction)`, `setListShareToken(listId, enabled)`,
`joinListByToken(token)`, `shareListWithEmail(listId, email, role)`,
`revokeListInvite`, `setMemberRole`, `removeMember`, `leaveList`.
Queries in `queries.ts`: `getMyLists()`, `getListById(id)`, `getListsForPinning()`.
Every mutation re-checks the caller's role on the list. Invite consumption lives
in `auth.ts`'s `signIn` event, delegating to a helper in `src/lib/actions/lists.ts`
(non-exported logic kept out of the action surface).

### Explicitly out of scope (say if you want it)

Per-day assignment (`plannedFor` on the item) for true weekly planning, and a
generated shopping list from a list's ingredients. Both are natural next steps
and the schema above leaves room for them.

**Commits:** (a) schema + migration + core actions/queries; (b) `/lists` +
`/lists/[id]` pages; (c) link sharing (token, join page, members panel) + the
`visibilityWhere` grant; (d) email sharing + pending-invite consumption on
sign-in; (e) pin button + dashboard section + batch "Add to list".

---

## 6. Camera capture

### Recommended: native capture attribute

A second hidden file input alongside the existing one:

```html
<input type="file" accept="image/*" capture="environment" ... />
```

plus a **Take photo** button next to "Add images" in `RecipeForm`. On iOS and
Android this opens the camera directly and the OS handles the permission prompt —
which is exactly the "ask for camera permissions if the user selects camera"
behaviour. Same `onAddImages` handler, same upload path, and the resulting photo
flows into the existing **Extract text** (OCR) button, so "snap a cookbook page →
recipe" works end to end.

On desktop, `capture` is ignored and the button falls back to a file picker; both
buttons are shown always rather than trying to feature-detect a camera.

**Caveat worth knowing:** `accept="image/*"` is wider than the four MIME types
`storage.ts` allows, so an iPhone photo picked from the library could arrive as
HEIC and be rejected server-side. Camera *capture* itself yields JPEG on iOS, so
this only affects library picks. I'll make the error message name the problem
("HEIC images aren't supported yet — …"). Proper HEIC support needs `sharp`,
which is already queued as PLAN.md §8.1.

### Alternative: in-app `getUserMedia` preview

A live video preview in the page with a shutter button, canvas → `File` → upload.
Better for taking several shots in a row without leaving the form, and works with
desktop webcams. Costs a permission-state UI (granted / denied / no camera), a
new client component, and HTTPS in production (your deploy is HTTP on port 3100
behind whatever proxy — worth checking, as `getUserMedia` is blocked on insecure
origins that aren't localhost).

I recommend the native attribute unless you specifically want the in-app preview.

**Commit:** one.

---

## Proposed order

Cheap and self-contained first, so each commit is easy to review and the big one
lands last on a settled foundation:

**All six are implemented.**

| # | Feature | Migration | Commits |
|---|---------|-----------|---------|
| 1 | F2 — search over instructions (fuzzy) | ✅ | `01241ec` |
| 2 | F6 — camera capture | — | `645aec6` |
| 3 | F4 — settings + default visibility | ✅ | `ad84c57` |
| 4 | F3 — notes | ✅ | `a9fd888`, `5be9a07` |
| 5 | F1 — batch select + tags/ingredients | — | `e462253`, `91e4ae6`, `509df55` |
| 6 | F5 — pinned lists | ✅ | `3aaeeac`, `56abc6c`, `1309026`, `5435aec`, `efd3bec` |

Four migrations in total; all apply automatically via `prisma migrate deploy`
on the next `docker compose up -d`. The F2 migration also creates the `pg_trgm`
and `unaccent` extensions.

### Deferred, in rough order of usefulness

- Batch **remove** tag, and batch set-visibility (cheap: `deleteMany` /
  `updateMany` over the same selection).
- Per-day assignment on list items (`plannedFor`) for true weekly planning, and
  a shopping list generated from a list's ingredients. The schema leaves room.
- ~~"Select all N matching the filter" across pages~~ — done (`d9dda25`).
  Resolved server-side to ids rather than passing the filter to the batch
  actions, so the selection stays a concrete set you can still deselect from.
- HEIC uploads (needs `sharp`; see PLAN.md §8.1).

Each step: `npm run build` (the typecheck gate) + `npm run lint`, and end-to-end
verification via the `verify` skill before committing.

---

## Decisions (settled)

1. **Lists:** multiple named lists, each shared independently.
2. **Private recipes on a shared list:** the list grants members read access,
   with the warnings described above. Read-only — never edit or delete.
3. **Sharing:** both a secret link *and* share-by-email, with email shares to
   people without an account held as pending invites until they first sign in.
4. **Camera:** native `capture` attribute.

Assumptions I've made and will proceed with unless you object: notes are private
to their author and included in *your own* search results; batch operations are
add-only in v1 and silently skip recipes you don't own (reporting the count);
admins do not automatically see other people's lists.
