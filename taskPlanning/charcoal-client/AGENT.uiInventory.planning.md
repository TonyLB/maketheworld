# Client UI Inventory and Obsolete-Code Sweep

**Status**: DISPOSITIONS CONFIRMED (2026-08-08) --- D1-D5 resolved by the user; one follow-on fork
(**D6**) opened by the D1 answer. Next step: resolve D6, then begin **Recommended order** step 3.

**Framework**: [`taskPlanning/AGENT.md`](../AGENT.md) --- durability tiers and what belongs here vs in
package docs. This plan is disposable; anything worth keeping after the sweep moves into
[`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) or a section-local `AGENT.md`.

**Commands**: [`AGENT.development.md`](AGENT.development.md) --- Vitest, run from `charcoal-client/`.

---

## Goal

The chat-spine refactor (see [`charcoal-client/AGENT.chatSpine.planning.md`](../../charcoal-client/AGENT.chatSpine.planning.md))
replaced a hierarchical, tab-navigated page layout with a play-spine-anchored UI. It did **not** sweep
the replaced surfaces out of the tree. This task:

1. Inventories every top-level client UI section against two independent axes --- **reachability**
   (can a user get there?) and **forward value** (does it prototype something we will return to?).
2. Records a disposition per section, with the *reason* attached, so a future reader knows why
   inert-looking code was kept.
3. Removes the sections dispositioned **Discard**, one reviewable slice at a time.

**Non-goal**: re-architecting anything that survives. If a Keep section needs work, that is a separate
plan.

**Scope note**: although this plan lives under `taskPlanning/charcoal-client/`, **slice E crosses
packages** --- discarding `Knowledge` strands the `directResponse` flag in `mtw-interfaces` and
`lambda/ephemera`. That is the only slice that leaves the client.

### Why the two axes are independent

Unreachable code is not automatically disposable, and this is the whole reason the sweep needs a plan
rather than a delete-unused-exports pass:

- **Maps** is the motivating case. Its `MapDThree` subtree is reduced-to-practice work on dynamic
  force-directed graphs (custom D3 forces: cascade, bounding, grid-influence, exit-seeker, flex-link).
  That is expensive art we will return to, independent of whether any route renders it today.
- Conversely, a section can still be wired into a route and be pure dead weight if nothing navigates
  to it and it prototypes nothing.

---

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../AGENT.md) once for durability conventions.
2. Read [`AGENT.development.md`](AGENT.development.md) for exact test commands. **Command authority**:
   if commands conflict, follow [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md).
3. Read [`charcoal-client/AGENT.chatSpine.planning.md`](../../charcoal-client/AGENT.chatSpine.planning.md)
   "Current System State" --- it is the record of *what* the spine replaced, and therefore the best
   single source for why a given section is orphaned.
4. Skim [`src/components/AppLayout/index.tsx`](../../charcoal-client/src/components/AppLayout/index.tsx)
   lines 216-230 (the whole route table) and
   [`src/components/AppController/index.tsx`](../../charcoal-client/src/components/AppController/index.tsx)
   (panel wiring). Between them they define every entry point into the client.
5. Baseline before any edit, from `charcoal-client/`:

   ```bash
   npm run test:single
   ```

---

## Reachability model (how the table's column was derived)

After the refactor there is exactly one root surface: `/` renders `PlaySpineRoot`. Everything else is
reached by an explicit in-app navigation or a typed URL. Three tiers:

| Tier | Meaning |
| --- | --- |
| **Live** | Rendered by the spine, or navigated to from a live surface |
| **URL-only** | A `<Route>` exists, but no live surface navigates to it. Reachable only by typing the URL |
| **Unreferenced** | No external import at all outside its own directory |

Evidence commands (run from `charcoal-client/`):

```bash
# External, non-test referrers of a section (relative imports only --- bare specifiers
# like @mui/icons-material/Home are false positives and must be excluded)
grep -rEl "from ['\"]\.[^'\"]*/Explore(/[^'\"]*)?['\"]" src --include='*.ts' --include='*.tsx' \
  | grep -v '^src/components/Explore/' | grep -v '\.test\.'

# Every in-app navigation target
grep -rE "navigate\(" src --include='*.tsx' --include='*.ts' | grep -v '\.test\.'
```

---

## Inventory

Sections are `src/components/*` unless noted. **LOC** excludes tests. **Disposition** values:
`Keep` (live or prototype value) / `Discard` (candidate for removal) / `Decide` (needs your call).

### Confirmed orphans --- primary discard candidates

| Section | LOC | Reachability | Evidence | Disposition |
| --- | ---: | --- | --- | --- |
| `Explore` | 156 | **URL-only** | Routed `/Explore` (`AppLayout:223`); sole external import is that route. Nothing navigates to it | Discard |
| `Home` | 271 | **URL-only** | Routed `/index.html` via `homePanel` (`AppLayout:226`, `AppController:57`). Nothing navigates to it. Contains a `navigate('/Library/')` button (`Home:246`) pointing at a **route that no longer exists** | Discard |
| `Threads` | 130 | **Unreferenced** | No external import. Legacy `.js`, pre-TypeScript | Discard |
| `DraggableTree` | 640 | **Unreferenced** | No external import anywhere in `src` (3 test files are self-referential) | **Discard** (D2) --- prototype of a drag-to-reorder **editing** style that was tried and rejected on UX grounds. Novel code, but the idea it embodies is closed, so it is not reduced-to-practice art we would return to. Deleting is deliberate, not an oversight |
| `MultiLevelNest` | 53 | **Unreferenced** | No external import | Discard |
| `NonLinearStepper` | 97 | **Unreferenced** | No external import | Discard |
| `TitledBox` | 43 | **Unreferenced** | No external import. Workbench uses its own `WorkbenchTitledBox.tsx` | Discard |
| `useContextMenu.js` | -- | **Unreferenced** | No external import. Legacy `.js` | Discard |
| `Maps/List` + `Maps/index.tsx` (`MapHome`) | ~50 | **Unreferenced** | `MapHome` imported nowhere; its own source comment says "not currently used" and that the legacy `Library/Edit/Asset` map route was removed | Discard --- **carve-out from the `Maps` Keep**; see D1 |

### The "Library" question

There is **no `src/components/Library`** --- the page component is already gone. What remains is
scattered residue, and this is a distinct cleanup shape from the sections above (dangling references,
not a dead directory):

| Residue | Location | Note |
| --- | --- | --- |
| Dead nav button | `Home:246` | `navigate('/Library/')`; no such route. Dies with `Home` |
| Dead nav labels | `Explore:103-131` | Library tile. Dies with `Explore` |
| `libraryDataSource` slice | `src/slices/libraryDataSource` | **Still live** --- iterated by `useSSM.ts`. Do **not** remove with the page residue |
| `zone === 'Library'` | `slices/UI/workbench/index.ts:311` | Asset *zone* concept, unrelated to the Library *page*. Keep |

### Keep --- prototype value despite low/no traffic

| Section | LOC | Reachability | Rationale |
| --- | ---: | --- | --- |
| `Maps/Edit/MapDThree` | (bulk of `Maps`' 2889) | Functionally dead | **Reduced-to-practice D3 force-graph work.** Custom forces (cascade, bounding, grid-influence, exit-seeker, flex-link), an iterator/tree simulation architecture, and its own docs (`AGENT.d3.md`, `documentation/README.*`). Keep regardless of traffic |
| `Maps/Edit/Area`, `Maps/Controller` | -- | Functionally dead | Rendering + gesture layer the D3 work is exercised through. Keep with `MapDThree` |
| `Maps/View` | -- | Functionally dead | **Keep for its D3 integration pattern** (D1): `View` wires a read-only display through the *same* `Controller` + `Edit/Area` stack that `Edit` uses. That view/edit-share-one-simulation pattern is the reusable part. See **D6** for the `AssetPicker` entanglement |

> **Correction to the working premise --- resolved by D1.** Map View/Edit is functionally dead (no map
> ephemera flows), but it is **not** unwired, and the sweep must remove the wiring explicitly rather
> than assume it is already gone. Live entry points that still exist today:
>
> - `map` command in play --- `Message/MessagePanel.tsx:48`
> - LineEntry SpeedDial Map action --- `LineEntry/index.tsx:114`
> - Options-mode map avatar --- `LineEntry/index.tsx:143`
> - `Workbench/MapEdit/MapEditor`, dispatched by `WorkbenchAssetEditor.tsx:65` for any `StandardMap`
>
> These are **live affordances into dead functionality** --- a user typing `map` today reaches a
> non-functional surface. Removing them is a user-visible fix, not just cleanup, and it is what
> converts `Maps` from "wired but dead" to honestly "kept as prototype."

### Live --- no action

`AppController`, `AppLayout`, `ActiveCharacter`, `Message`, `LineEntry`, `Workbench` (13411 LOC, the
authoring surface), `Editor`, `ThinkingDashboard`, `CharacterSelection`, `CharacterAvatar`,
`CharacterChip`, `CharacterStyleWrapper`, `ChoiceDialog`, `Onboarding`, `SignIn`, `UI`, `MiniChip`,
`WhoDrawer.tsx` (sidebar at >=1500px), `InDevelopment.tsx`, `ScreenCenter.tsx`, `Spinner.tsx`,
`CodeOfConductConsent.tsx`.

### Resolved by user decision

| Section | LOC | Reachability | Disposition |
| --- | ---: | --- | --- |
| `Settings` | 125 | **URL-only** | **Keep** (D3). Routed `/Settings/`; nothing navigates in (it navigates *out* to `/` at `Settings:115`). Retained by intent --- the spine is expected to grow a settings affordance. Do **not** delete as an orphan in a future sweep |
| `Knowledge` | 82 | **URL-only** | **Discard** (D3). Its only inbound navigations are `Home:201` and `Explore:77`, both themselves discards. Has a **cross-package consequence** --- see below |
| `AssetPicker` | 54 | Reached only via `Maps/View` | **Discard** (D1). Sole external import is `Maps/View/index.tsx:24`, used at `:168` for the map-room-import-into-draft flow. See **D6** |

### Knowledge removal --- cross-package consequence (`directResponse`)

`Knowledge/index.tsx:32` is the **only place in the entire repo** that sets `directResponse: true`.
Deleting the component makes the flag a dead parameter end-to-end, so this slice crosses from
`charcoal-client` into `mtw-interfaces` and `lambda/ephemera`. Producers/consumers to unwind:

| File | Line | What |
| --- | ---: | --- |
| `charcoal-client/src/components/Knowledge/index.tsx` | 32 | **Sole producer.** Sets the flag on a `link` socket dispatch |
| `packages/mtw-interfaces/ts/ephemera.ts` | 92 | `directResponse?: boolean` on the request interface |
| `lambda/ephemera/app.ts` | 244 | Conditional spread onto the parsed action |
| `lambda/ephemera/dataSource/actions/index.ts` | 437 | Conditional spread onto `Look Command Requested` |
| `lambda/ephemera/dataSource/actions/baseClasses.ts` | 181, 488 | Type field + runtime validator |
| `lambda/ephemera/dataSource/actions/publishedEvents.ts` | 187, 429 | Type field + runtime validator |
| `lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts` | 108-109 | The behavior: `SESSION#` targeting branch vs. targeting the character |
| `charcoal-client/src/slices/perceptionCache/index.ts` | 24 | Comment describing the `SESSION#` Target it must tolerate |
| Doc comments | `prepareFeatureKnowledgeRenderForCharacter.ts:66`, `perception/orchestrate.ts:494,570` | Reference `directResponse` as the contrast case; must be reworded, not just deleted |

**Scoping guard --- do not over-delete.** Removing `directResponse` removes *only the Knowledge-look
branch* of `SESSION#` targeting. The `PublishTargetSession` machinery is independently live
(`positions/membership/applyCharacterRoomMembership.ts:133`, `publishMessage/index.ts:136-154`,
`messageBus/baseClasses.ts:34-35`) and **must stay**. Likewise `messages.ts:24` types `Target` as
`EphemeraCharacterId | SESSION#${string}` for reasons beyond Knowledge.

Test files asserting the flag (delete or retarget with the code):
`lambda/ephemera/app.test.ts:383-406`, `dataSource/actions/index.test.ts:860-894`,
`dataSource/actions/publishedEvents.test.ts:412-453`, `dataSource/actions/parseCommand.test.ts:471-492`,
`renderOrchestration/handleLookCommandRequestedForRenderOrchestration.test.ts:186-220`.

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package
`AGENT.concepts.md`. When a decision ships, record it in the relevant durable doc and remove the row.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| D1 | `Maps` is **functionally dead**. `AssetPicker` discarded; `Maps/View` **kept** for its D3 integration pattern; `Maps/Edit`/`MapDThree` kept. Live nav into the dead surface gets removed | 6 | **Decided** |
| D2 | `DraggableTree` is a **rejected** editing-style prototype --- discard despite its size | 3 | **Decided** |
| D3 | `Settings` **keeps** (spine will grow an affordance); `Knowledge` **discards** (and takes `directResponse` with it) | 5, 7 | **Decided** |
| D4 | **Hard delete.** Git retains history; single dev instance, no external consumers | all | **Decided** |
| D5 | **Yes** --- mark keep-for-prototype sections so the next sweep does not re-litigate them. Mechanism in step 8 | 8 | **Decided** |
| D6 | `Maps/View` is Keep but imports the Discard'd `AssetPicker`. **Strip** `View`'s AssetPicker-dependent import-to-draft flow --- it is asset-import plumbing, not part of the D3 pattern being preserved. `AssetPicker` goes | 6 | **Decided** |

**All decisions resolved.** No fork blocks any remaining slice.

---

## Recommended order

Pending work uses `[ ]`, completed work uses `[X]`. Mark nested lines `[X]` as each is done, not just
the parent. Each numbered step is intended to be a **separately reviewable commit**.

- [X] 1. **Confirm the inventory.** User reviewed and corrected dispositions. No code changes.
- [X] 2. **Resolve D1-D5.** All decided; D1's answer opened **D6**.
- [ ] 3. **Slice A --- unreferenced leaves.** Lowest risk: nothing imports these. Hard delete (D4).
  - [ ] Delete `Threads`, `MultiLevelNest`, `NonLinearStepper`, `TitledBox`, `useContextMenu.js`
  - [ ] Delete `DraggableTree` (D2) --- including its 3 test files
  - [ ] Verify: `npm run test:single` + `npx tsc --noEmit`
- [ ] 4. **Slice B --- `Explore`.** Single route, single import.
  - [ ] Delete `src/components/Explore`; remove import and `<Route path="/Explore">` from `AppLayout`
  - [ ] Verify
- [ ] 5. **Slice C --- `Home` + Library residue.** Larger blast radius: touches `AppController` panel wiring.
  - [ ] Delete `src/components/Home`; remove `homePanel` prop threading through `AppController`/`AppLayout` and the `/index.html` route
  - [ ] Confirm no remaining `navigate('/Library/')`; leave `libraryDataSource` and `zone === 'Library'` alone
  - [ ] Verify
- [ ] 6. **Slice D --- `Maps` de-wiring.** This slice removes *access*, keeping the prototype.
  - [ ] Remove the three live nav call sites: `MessagePanel.tsx:48` (`map` command), `LineEntry/index.tsx:114` (SpeedDial), `LineEntry/index.tsx:143` (Options avatar)
  - [ ] Remove the `/Character/:CharacterId/Map/` route from `AppLayout`'s `CharacterRouterSwitch`
  - [ ] Delete `Maps/List` + `Maps/index.tsx` (`MapHome`) --- already unreferenced
  - [ ] Strip `Maps/View`'s import-to-draft flow (D6): the `AssetPicker` import at `View/index.tsx:24` and its use at `:168`, plus whatever of `importOptions` / `onImportListItemClick` / `addImportToDraft` becomes unreachable. **Preserve** the `MapArea` + `MapDisplayController` wiring --- that is the pattern being kept
  - [ ] Delete `src/components/AssetPicker`
  - [ ] Decide the `WorkbenchAssetEditor.tsx:65` `StandardMap` branch: leaving it means the workbench still opens a dead editor for Map components
  - [ ] Verify
- [ ] 7. **Slice E --- `Knowledge` + `directResponse`** (D3). **Cross-package; land the client before the lambda.**
  - [ ] Client: delete `src/components/Knowledge`, its `/Knowledge/` routes, and the `perceptionCache` comment at `index.ts:24`
  - [ ] Interfaces: drop `directResponse` from `mtw-interfaces/ts/ephemera.ts:92`
  - [ ] Lambda: unwind `app.ts:244`, `actions/index.ts:437`, `actions/baseClasses.ts:181,488`, `actions/publishedEvents.ts:187,429`, and the `handleLookCommandRequestedForRenderOrchestration.ts:108-109` targeting branch
  - [ ] Reword (do not delete) the doc comments that cite `directResponse` as a contrast case
  - [ ] **Guard:** leave all general `SESSION#` targeting machinery intact --- see the scoping guard above
  - [ ] Verify client (`npm run test:single`) **and** the full ephemera suite, including `*.integration.test.ts`, which sit outside `tsconfig` and are not covered by `tsc`
- [ ] 8. **Prototype markers** (D5). Add a short "Kept as prototype --- not live" header to [`src/components/Maps/AGENT.md`](../../charcoal-client/src/components/Maps/AGENT.md) stating what is preserved (D3 force-graph art; the view/edit-shared-simulation pattern), that no route reaches it, and that it should not be swept as an orphan. Do the same for `Settings` (kept by intent, awaiting a spine affordance) so the next reader does not re-litigate either.
- [ ] 9. **Durable doc pass.** [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) still documents the pre-refactor world --- Library routes, tab navigation, and a `/Library/Edit/Asset/:AssetId/*` routing table that no longer exists. Rewrite its routing and mode sections to match the spine. **This is the step that must not be skipped** --- with step 8 it is the only part of this plan that outlives the plan.
- [ ] 10. **Delete this planning file.**

---

## Verification

Run from `charcoal-client/` after every slice:

```bash
npm run test:single
npx tsc --noEmit
```

Then confirm no dangling references to the removed section (substitute the name):

```bash
grep -rn "Explore" src --include='*.ts' --include='*.tsx' | grep -v '@mui'
```

**The `@mui` filter is required.** `@mui/icons-material/Home` and `@mui/icons-material/Explore` are
imported by live code and will otherwise read as false-positive survivors --- this is exactly the trap
that inflated the first pass of this inventory.

Note that `tsc` does not necessarily cover every test file in this repo; the full Vitest run is the
authority for "nothing broke."

**Slice E only (cross-package).** `lambda/ephemera`'s `*.integration.test.ts` files sit **outside**
`tsconfig`, so a clean `tsc` there proves nothing about them. Run the full ephemera suite, and grep for
the string `directResponse` (not just the symbol) across `lambda/`, `packages/`, and `charcoal-client/`
before calling that slice done:

```bash
grep -rn "directResponse" --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v '/dist/'
```
