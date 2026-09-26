# Workbench `Gloss` authoring (ISS8187)

**Status:** Slices 0 and 1 shipped 2026-09-26. Next: slice 2 (shared session literal field), built on slice 1's `ShortNameHost`/`GlossHost`/`isGlossHost`. The first attempt at slice 2 was reverted, because it wrote `_payload` through a cast.

This plan is task-scoped and follows [`taskPlanning/AGENT.md`](../AGENT.md). It is an implementation plan.

## Why

`Gloss` is a short physical description for reasoning, not for display. It is live from WML through Assets to Ephemera's `ludicCache`, and `CommandAttempt` reads it for referent prose. Its authoring rules are in [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (optional wherever it is hosted, trimmed, empty treated as absent, plain text), and its reasoning use is in [`lambda/ephemera/dataSource/actions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (`CommandAttempt` section). Today the only way to author one is to write `<Gloss>` in WML source. This plan adds it to the Workbench for the five kinds that carry it: Room, Area, Feature, Character and Object.

## Scope

- **Room, Area, Feature:** these are already on the component session and already use `WorkbenchShortNameField`. `Gloss` is added as a sibling session field.
- **Character:** `CharacterEditor` is not on the component session. It edits ShortName in asset mode (its local `LiteralShortNameField`, with a per-change `updateStandard`). `Gloss` is added as an asset-mode sibling of that field (decided 2026-09-26). Moving Character onto the session is separate work. The Workbench AGENT.md already lists it under "Not on component session yet".
- **Object:** no editor exists. This plan builds a **minimal session-based `ObjectEditor` with ShortName and Gloss only**, plus a route to reach it (decided 2026-09-26). Object is where the gloss matters most, since it feeds the referents in Identify and adjudication.
- **Out of scope:**
  - Object prose (`situations`) and the Object `ludicGraph` (nested objects).
  - Placing Objects in rooms (Area graph nodes have no `Object` tag).
  - Moving Character onto the session.
  - Feeding the gloss into embeddings.

## Premises checked against code (2026-09-26)

- **The base `StandardComponent` interface doesn't say which kinds host which literal field** ([`baseClasses.ts`](../../packages/mtw-wml/ts/standardize/components/baseClasses.ts), [`component.ts`](../../packages/mtw-wml/ts/standardize/components/component.ts)). Rechecked 2026-09-26. This replaces the earlier premise that "`withGloss` is a no-op on non-hosts, so flush can stay kind-agnostic", which hid the problem.
  - **ShortName is on every kind.** All 14 `componentClassFactory` classes have `_shortName`. The interface was right to carry it, but only by coincidence: the payload interface (`ComponentConstructorMethods`) didn't declare `_shortName`, so the `shortName` getter and `withShortName` reached it through a cast and a runtime `isShortNamePayloadHost` check. *Closed by slice 1.*
  - **Gloss is on 5 kinds only:** Room, Area, Feature, Character and Object. Even so, `gloss` and `withGloss` were on every component, and `withGloss` quietly did nothing elsewhere. The interface therefore promised something false (that every kind accepts a gloss). Nothing typed as `StandardComponent` could narrow to "hosts a gloss" without a cast or a check on `_payload`, and `_payload` isn't on the interface; only the factory's generated class exposes it. *Closed by slice 1:* `GlossHost` on the five classes, and `isGlossHost`.
  - **Consumers today:** `withGloss` has none. `withShortName` has one outside mtw-wml's tests (the Workbench flush). The only code that reads `.gloss` through the base interface is Ephemera's `glossFromComponent` ([`objectShortName.ts`](../../lambda/ephemera/dataSource/objects/objectShortName.ts)). Its doc comment wrongly says Gloss is "optional on every kind".
  - **Runtime check is sound.** In charcoal-client's runtime, `'_gloss' in payload` is true for Rooms (built from schema, from JSON, or cloned) and false for Knowledge (probed 2026-09-26). An mtw-wml-owned typeguard can rely on it.
- **`withGloss` does not normalize.** `normalizeGloss` (trim, empty treated as absent) runs only in `createGlossFromJSON` and the standardize consumer ([`glossField.ts`](../../packages/mtw-wml/ts/standardize/components/glossField.ts)). The Workbench edit path assigns the payload directly, so normalization has to happen at flush, the way D11's `normalizeOptionalLiteral` already does for shortName ([`workbenchMutations.ts`](../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts)).
- **`WorkbenchShortNameField`** ([`WorkbenchShortNameField.tsx`](../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/WorkbenchShortNameField.tsx)) is about 60 lines. Only two things in it are specific to ShortName: which field it reads (`working.shortName`) and which setter it calls (`setWorkingShortNameFromString`). Room, Area, Feature, Knowledge, Guidance and Lens all use it.
- **Objects are unreachable in the Workbench.**
  - `WorkbenchAssetEditor` routes `StandardObject` to an empty `<Box />`.
  - `TopLevelEditor`'s `isTopLevelAssociable` and `ADD_OPTIONS` both leave Object out.
  - `LudicGraphNodesEditor`'s node tags are Room, Feature, Character and Area only.
- **Object's ShortName is required and non-empty, but only because of how Object was first prototyped.** The rule is enforced in the Object converter's `finalize` in [`schema/converters/components.ts`](../../packages/mtw-wml/ts/schema/converters/components.ts).
  - **Origin.** `<Object>` began on 2026-04-12 (ISS7495, `4b34e5c36`) as an ephemera-wire-only tag, `<Object>roller skates</Object>`. Its trimmed text body was the object's handle, meaning its identity on the wire. A few minutes later (`7bcd9842e`), the handle moved into a `<ShortName>` child and the non-empty rule came with it. The rule's reason did not: identity is now the `OBJECT#` uuid, and ShortName is a label, as on every other kind.
  - **Downstream copes without a name.** [`catalogHandles.ts`](../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts) and `heldInventoryCatalogForCharacter.ts` skip a node with no `shortName`. An unnamed Object therefore can't be referred to by a player, the same as an unnamed Feature today, but nothing crashes.
  - **Decided (2026-09-26):** remove the rule at its source (slice 0), rather than adding an Object-only exception to the Workbench flush.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| WG-3 | **Literal-field capabilities are declared, not inferred from `_payload`.** Each literal field module exports a host interface: `ShortNameHost` from `shortNameField.ts` and `GlossHost` from `glossField.ts`. Each declares the getter plus a `with…(literal): this` method. `StandardComponent extends ShortNameHost`, which is true because every kind hosts it. `gloss` and `withGloss` come off the base interface and the class factory. The five classes that host Gloss `implements GlossHost`. mtw-wml owns `isGlossHost(component): component is StandardComponent & GlossHost`. As shipped (slice 1), it checks for the declared `withGloss` method rather than the payload, so no code anywhere inspects `_payload` to decide; each of the five classes carries its own three-line `gloss`/`withGloss`, typed through its own payload (a shared helper would wrap one assignment). Callers outside mtw-wml (the Workbench, Ephemera) narrow with `isGlossHost` and write through `with…`, never by assigning `_payload` and never through a cast. **Scope: literal fields only** (user, 2026-09-26). The other per-kind abilities that quietly do nothing on the base interface (`withChild`, `assureReferences`, `removeReferences`, optional `invert?`) and the Workbench's `_situations` payload casts ([`workbenchMutations.ts`](../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts)) are the same problem, recorded as a follow-up in slice 6. | 2 | Decided 2026-09-26; mtw-wml half shipped (slice 1) |
| WG-1 | **How an author reaches an Object.** Add `StandardObject` to `isTopLevelAssociable`, `TAG_ICONS` **and `ADD_OPTIONS`**, so Objects can be created, listed, pinned and navigated to from the asset root. | 5 | Decided 2026-09-26 |
| WG-2 | **Default ShortName on a new Object.** A new Object starts with the ShortName `object`, which the author can then edit. `materializeComponent` seeds it on the component that `standardComponentFactory` returns, for the Object tag only. This is a convenience, not a validity guard. Once slice 0 ships, an Object with no ShortName parses, so an emptied Object ShortName follows D11 (flushes as absent) like every other kind, and the flush has no Object-only exception. | 5 | Decided 2026-09-26 |

## Recommended order

Mark pending work `[ ]` and completed work `[X]`, including nested lines, as each one is done.

0. [X] **Make Object's ShortName optional** (mtw-wml). Removes a leftover from Object's ephemera-wire prototype (see Premises). After this slice, Object's ShortName behaves like the ShortName on Room, Feature and the other kinds. Shipped 2026-09-26.
   - [X] In the Object converter's `finalize` ([`schema/converters/components.ts`](../../packages/mtw-wml/ts/schema/converters/components.ts)), dropped the "exactly one ShortName child" check, the "non-empty text after trim" check, and the trim canonicalization — matched Room exactly (Room has no schema-layer `ShortName` handling at all; confirmed via `schema/index.ts`'s `closeContext`, which uses the raw `{ data, children }` node when `finalize` is absent). `Object.finalize` now only normalizes the uuid and returns `children` unchanged; the Remove/Replace-wrapper unwrap (`splitTaggedChildren`) was dropped along with the cardinality check it existed to route around — a wrapped `ShortName` edit now round-trips via the framework's generic handling, the same as Room's.
   - [X] Tests:
      - `room.ephemeraWire.integration.test.ts:101-111` ("throws when Object ShortName is whitespace-only") replaced by a test that such an Object parses, with `shortName.toJSON()` equal to `''` (whitespace-only text between tags isn't significant WML content, so it doesn't survive as literal content — matching Room, not "no shortName at all": the field is present but empty);
      - `glossRoundTrip.test.ts`'s "contrasts with Object ShortName, which is required ..." replaced with a round-trip test of an `<Object>` with no `<ShortName>` child at all, confirming `object.shortName` is `undefined` and the printed WML is a self-closing `<Object uuid=(test) />`.
   - [X] Docs: updated [`components/AGENT.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.md) (lines 158/160) and [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (the Gloss section and the `StandardObject` `fromSchema`/"ShortName Replace/With editing" bullets) to drop the required/enforced-on-Object language and describe Object's converter as deferring to the standardize layer like Room.
   - [X] Downstream check: ran the full `mtw-wml` suite, the full `lambda/ephemera` suite, `charcoal-client`'s `src/components/Workbench` suite, and `charcoal-client`'s `npm run check` (all green; `check`'s 12 pre-existing errors are unchanged and unrelated — `MapDisplay.tsx`, `RoomDescription.tsx`, `LudicGraphNodesEditor.tsx`, `LensMarkFacetsEditor/index.ts`, `buildGenerationContextSubset.ts` — since no `charcoal-client` file was touched in this slice). Grepped Ephemera's `shortName` call sites (`objectShortName.ts`, `resolveObjectMovePresentationLabels.ts`, `roomObjectCatalogForCharacter.ts`, `objectRenderWmlFromCacheRecord.ts`) — all already optional-chain or fall back to a placeholder; `roomObjectCatalogForCharacter.ts`'s unguarded `normalizeExitName(shortName)` call is fed only by `catalogHandles.ts`'s already-filtered (shortName-present) handles, so it stays safe.
1. [X] **Declare literal-field capabilities** (mtw-wml, WG-3). No change to WML or JSON output. What changes is which types say they carry ShortName and Gloss. Shipped 2026-09-26.
   - [X] `shortNameField.ts` / `glossField.ts` export `ShortNameHost` / `GlossHost` (getter + `with…(literal: StandardLiteral | undefined): this`). `glossField.ts` exports `isGlossHost`, which checks for the declared `withGloss` method, **not** the payload (differs from the plan's "checks the payload"; see WG-3). The payload-level guards `isShortNamePayloadHost`, `isGlossPayloadHost` and `literalFieldFactory`'s `isPayloadHost` became unused and were deleted; the `ShortNamePayloadHost`/`GlossPayloadHost` types stay (standardize consumers; the client's `setWorkingShortNameFromString` until slice 2).
   - [X] `ComponentConstructorMethods` declares `_shortName?: StandardLiteral`. The generated class's `shortName` getter and `withShortName` read and write it with no cast or check. `withShortName` returns `this`.
   - [X] `baseClasses.ts`: `StandardComponent extends ShortNameHost`. `gloss`/`withGloss` removed from the interface and the generated class.
   - [X] Room, Area, Feature, Character and Object each `implements GlossHost`. Each carries its own three-line `gloss`/`withGloss`, typed through its own payload with no cast, instead of a shared helper (which would have wrapped a single assignment).
   - [X] Consumers: `glossFromComponent` narrows with `isGlossHost`, and its comment now says five kinds. The client's `prepareComponentForFlush` dropped its `as T`. A grep of `withGloss`/`.gloss` across `lambda`, `packages` and `charcoal-client` (including Ephemera's integration tests) finds no other component reads.
   - [X] Tests in `glossRoundTrip.test.ts`:
      - `isGlossHost` is true for the five and false for Knowledge, Guidance and Lens, whether built from WML, from JSON or cloned;
      - `withGloss` round-trips `<Gloss>` in and out of WML on each host, leaving the receiver unchanged;
      - compile-time narrowing (`@ts-expect-error` on `withGloss` via `StandardComponent` and via `StandardKnowledge`; `withShortName` returns `StandardRoom`).
      - **Gap:** ts-jest runs mtw-wml transpile-only (tsconfig `isolatedModules`) and `tsc` excludes tests, so `npm test` does not enforce the compile-time cases. They were verified with a one-off `tsc` over the file, including a check that removing a directive produces an error. The test file carries a comment saying so.
      - The only change to an existing test is the case type (`StandardComponent & GlossHost`).
   - [X] Docs:
      - [`components/AGENT.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.md) ("Literal-field factory": host interfaces, `isGlossHost`, "optional on each of those five");
      - [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (the `withShortName` bullet and the Gloss section);
      - deleted `glossField.ts`'s stale "unlike ShortName on Object" comment.
2. [ ] **Shared session literal field** (no behaviour change). This is the client-side counterpart of mtw-wml's `literalFieldFactory`, so that `Gloss` can be built as "like ShortName, except ...". See the precedent in [`AGENT.architecture.codeOrganization.md`](../../AGENT.architecture.codeOrganization.md#the-precedent). Built on slice 1's host interfaces, with no `_payload` access and no casts.
   - [ ] `updateComponent` ([`useWorkbenchComponent.tsx`](../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx)) accepts an updater that returns a replacement `T`, so edits can go through `with…` (which returns a new instance). Updaters that mutate in place keep working.
   - [ ] Extract `createWorkbenchLiteralField(descriptor)`. The descriptor has a host guard (a typeguard `StandardComponent -> H`), `read(host: H)`, `write(host: H, literal): H` and the default label/placeholder. The field narrows `working` with the guard. If the guard fails, the field throws: that means it was mounted on a kind without the field, which is a programming error, not something to hide by rendering nothing.
   - [ ] `WorkbenchShortNameField` becomes the ShortName instance of the factory (every component is a `ShortNameHost`, so its guard accepts all), with the same export name and props. Delete `setWorkingShortNameFromString` and move its callers (`MarkEdit/InlineEditor.tsx`, `reducers.test.ts`) to `withShortName`.
   - [ ] Remaining gap, stated plainly: nothing ties a field to its provider's guard at compile time. A Gloss field mounted in `KnowledgeEditor` compiles, then throws on first render. Any test that renders that editor catches it.
   - [ ] `WorkbenchShortNameField.test.tsx` stays green with no edits. `reducers.test.ts` changes only how it calls the setter, not what it asserts.
3. [ ] **`Gloss` on Room, Area and Feature** (session kinds).
   - [ ] Add `WorkbenchGlossField` as the factory's second instance, guarded by `isGlossHost`. Label "Gloss". The helper text says it is a reasoning-only physical description that players never see. A single line is enough.
   - [ ] Extend `prepareComponentForFlush`: when `isGlossHost(component)`, apply `withGloss(normalizeOptionalLiteral(component.gloss))`. It narrows first, rather than relying on a method that does nothing on other kinds.
   - [ ] Place the field directly under `WorkbenchShortNameField` in `RoomEditor`, `AreaEditor` and `FeatureEditor`. Knowledge, Guidance and Lens don't get it, since they have no gloss.
   - [ ] Tests:
      - a field test that mirrors `WorkbenchShortNameField.test.tsx` (renders, edits `working`, respects readonly);
      - `workbenchMutations.test.ts` flush cases (trimmed; whitespace-only becomes absent; unchanged on components with no gloss);
      - a payoff test that ends at the flushed component's WML text carrying `<Gloss>`, not at `working.gloss`.
4. [ ] **`Gloss` on Character** (asset-mode sibling).
   - [ ] Add a `LiteralGlossField` beside `CharacterEditor`'s `LiteralShortNameField`, with the same debounced `updateStandard` pattern. It writes through `StandardCharacter.withGloss`, since `StandardCharacter` is a `GlossHost`. Normalize at set time (trim, empty becomes `undefined`) using the same helper, since this path skips `prepareComponentForFlush`.
   - [ ] Test: editing the field reaches the committed `StandardCharacter`'s WML as `<Gloss>`. Clearing it removes the tag.
5. [ ] **Minimal `ObjectEditor`** (WG-1, WG-2).
   - [ ] Add `ObjectEdit/ObjectEditor.tsx` on `WorkbenchComponentProvider`, with a `StandardObject` guard, `WorkbenchShortNameField` and `WorkbenchGlossField`.
   - [ ] In `WorkbenchAssetEditor`, route `StandardObject` to `ObjectEditor` instead of `<Box />`.
   - [ ] Reachability (WG-1): add Object to `isTopLevelAssociable`, `TAG_ICONS` and `ADD_OPTIONS`, and to the `AddComponentTag` union. Check that `componentTagFromUniversalKey` and `standardComponentFactory` accept an `OBJECT#` key.
   - [ ] Default ShortName (WG-2): `materializeComponent` seeds `object` on a new Object. The flush is unchanged.
   - [ ] Tests:
      - routing (an Object component renders `ObjectEditor`);
      - `materializeComponent.test.ts`: a new Object carries ShortName `object`, and other kinds are unchanged;
      - a payoff test: Add Object from the asset root, then edit the Gloss. It ends at the Object's WML carrying `<ShortName>object</ShortName>` and `<Gloss>` and re-parsing cleanly;
      - clearing the Object's ShortName flushes WML with no `<ShortName>` that still re-parses. This relies on slice 0.
6. [ ] **Docs and close.**
   - [ ] Update [`Workbench/AGENT.md`](../../charcoal-client/src/components/Workbench/AGENT.md):
      - the Key Files table (the shared literal field, `WorkbenchGlossField`, `ObjectEdit/`);
      - "Session-bound field components" and the two-tier table's "Component `clone()` + payload mutate" wording (edits now go through `with…`);
      - the `WorkbenchAssetEditor` routing list under "System Relationships".
   - [ ] Replace "No authoring UI yet (ISS8187)" in [`mtw-wml components AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) with a pointer to the Workbench fields.
   - [ ] Record WG-2's default ShortName for a new Object in `Workbench/AGENT.md` (under consistency / materialize), and remove the WG rows here.
   - [ ] File follow-ups for Object placement and prose, if they aren't already tracked.
   - [ ] Record WG-3's out-of-scope remainder in [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md), next to the host interfaces. That remainder is: `withChild`, `assureReferences`, `removeReferences` and `invert?` quietly do nothing on the base interface, and the Workbench casts `_payload` to write `_situations`. Both need declared capabilities in the same way.
   - [ ] Run a graduation sweep: grep `taskPlanning/` and the repo for links to this file, then delete it.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../AGENT.md).
2. Read [`Workbench/AGENT.md`](../../charcoal-client/src/components/Workbench/AGENT.md): the component session's two tiers, session-bound fields, and the asset-level `updateStandard` exceptions (Character).
3. Read mtw-wml's `Gloss` rules: [`components/AGENT.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.md) ("Literal-field factory: `ShortName` and `Gloss`") and [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (the `gloss` section, and `StandardObject`'s required ShortName).
4. Read [`AGENT.architecture.codeOrganization.md`](../../AGENT.architecture.codeOrganization.md). Slice 1 applies its "the interface declares everything the container calls" technique in mtw-wml. Slice 2 applies its sibling-and-factory precedent on the client side.
5. Testing authority:
   - `charcoal-client`: [`AGENT.development.md`](AGENT.development.md), then [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md). The client uses Vitest, not Jest flags.
   - `mtw-wml` (slices 0, 1): [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md) (Jest).
   - `lambda/ephemera` (downstream checks for slices 0 and 1): [`lambda/ephemera/AGENT.testing.md`](../../lambda/ephemera/AGENT.testing.md). Integration tests (`*.integration.test.ts`) sit outside `tsconfig`, so run the suite, not just `tsc`.
   - If commands conflict, follow those files.
6. Baseline, which should pass before any edit (from the repo root):

```bash
npm --prefix packages/mtw-wml run test
(cd lambda/ephemera && npm run test -- --watchAll=false)
(cd charcoal-client && npm run test:single -- src/components/Workbench)
(cd charcoal-client && npm run check)   # tsc --noEmit; note the pre-existing error count, and add none
```

## Verification

- Slice 0: the full `mtw-wml` suite, the full `lambda/ephemera` suite, and `charcoal-client`'s `npm run check` with no new errors. The only existing test edits are the two named in the slice.
- Slice 1: the full `mtw-wml` suite, the full `lambda/ephemera` suite, and `charcoal-client`'s `npm run check` with no new errors, because the base interface change reaches every package. Existing tests change only where they call a removed method, never in what they assert.
- Slices 2-5: the `charcoal-client` baseline commands. `npm run check` must report no new errors.
- Slice 2: no assertion edits. A no-behaviour slice that needs different assertions has changed behaviour. Test edits that only change how a removed setter is called are allowed.
- Slices 3-5: the new tests named in each slice. Payoff tests end at WML text (the observable authoring output), not at `working`.
- After slices 1 and 2: `grep -rn "as unknown as" charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts` shows only the `_situations` casts, which WG-3 leaves out of scope.
