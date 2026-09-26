# Workbench `Gloss` authoring (ISS8187)

**Status:** Not started (plan opened 2026-09-26). Next: slice 0 (make Object's ShortName optional in mtw-wml).

This plan is task-scoped and follows [`taskPlanning/AGENT.md`](../AGENT.md). It is an implementation plan.

## Why

`Gloss` is a short physical description for reasoning, not for display. It is live from WML through Assets to Ephemera's `ludicCache`, and `CommandAttempt` reads it for referent prose. Its authoring rules are in [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (optional on every kind, trimmed, empty treated as absent, plain text), and its reasoning use is in [`lambda/ephemera/dataSource/actions/AGENT.concepts.md`](../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (`CommandAttempt` section). Today the only way to author one is to write `<Gloss>` in WML source. This plan adds it to the Workbench for the five kinds that carry it: Room, Area, Feature, Character and Object.

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

- **`gloss` / `withGloss` are on the base `StandardComponent`** ([`component.ts`](../../packages/mtw-wml/ts/standardize/components/component.ts)). `withGloss` is a no-op on components whose payload doesn't host `_gloss`. This means flush normalization can stay kind-agnostic, like `prepareComponentForFlush`'s `withShortName` call.
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
| WG-1 | **How an author reaches an Object.** Add `StandardObject` to `isTopLevelAssociable`, `TAG_ICONS` **and `ADD_OPTIONS`**, so Objects can be created, listed, pinned and navigated to from the asset root. | 4 | Decided 2026-09-26 |
| WG-2 | **Default ShortName on a new Object.** A new Object starts with the ShortName `object`, which the author can then edit. `materializeComponent` seeds it on the component that `standardComponentFactory` returns, for the Object tag only. This is a convenience, not a validity guard. Once slice 0 ships, an Object with no ShortName parses, so an emptied Object ShortName follows D11 (flushes as absent) like every other kind, and the flush has no Object-only exception. | 4 | Decided 2026-09-26 |

## Recommended order

Mark pending work `[ ]` and completed work `[X]`, including nested lines, as each one is done.

0. [ ] **Make Object's ShortName optional** (mtw-wml). Removes a leftover from Object's ephemera-wire prototype (see Premises). After this slice, Object's ShortName behaves like the ShortName on Room, Feature and the other kinds.
   - [ ] In the Object converter's `finalize` ([`schema/converters/components.ts`](../../packages/mtw-wml/ts/schema/converters/components.ts)), drop both the "exactly one ShortName child" check and the "non-empty text after trim" check. First read how Room's converter treats ShortName children. Then either keep the trim canonicalization, if it still earns its place, or match Room, and note the choice in the commit. Keep the Remove/Replace-wrapper handling working for a ShortName that *is* present.
   - [ ] Tests:
      - `room.ephemeraWire.integration.test.ts:101-111` ("throws when Object ShortName is whitespace-only") is replaced by a test that such an Object parses with no `shortName`;
      - `glossRoundTrip.test.ts:111` ("contrasts with Object ShortName, which is required ...") is rewritten or removed, since the contrast is gone;
      - add a WML-text round trip of an `<Object>` with no `<ShortName>` (under `<Asset>`), in the style of `shortNameRoundTrip.test.ts`.
   - [ ] Docs: remove the requirement from [`components/AGENT.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.md) (the literal-field factory section, line 158, and Gloss's "unlike ShortName" contrast, line 160) and from [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md). That covers line 109 (Gloss's "unlike ShortName" note) and the `StandardObject` fromSchema bullet (line 133: "required" and "`<Render>` alongside `<ShortName>`").
   - [ ] Downstream check: run the `lambda/ephemera` and `charcoal-client` suites (see Verification). Grep Ephemera for any code that assumes an Object always has a `shortName`, beyond the catalog skips already confirmed.
1. [ ] **Shared session literal field** (no behaviour change). This is the client-side counterpart of mtw-wml's `literalFieldFactory`, so that `Gloss` can be built as "like ShortName, except ...". See the precedent in [`AGENT.architecture.codeOrganization.md`](../../AGENT.architecture.codeOrganization.md#the-precedent).
   - [ ] Extract a session literal-field component (e.g. `WorkbenchLiteralField`), parameterized by a field descriptor: read the literal from `working`, write a string onto the draft, plus the default label and placeholder.
   - [ ] `WorkbenchShortNameField` becomes one instantiation of it, with the same export name and props. No caller changes.
   - [ ] `WorkbenchShortNameField.test.tsx` stays green with no edits.
2. [ ] **`Gloss` on Room, Area and Feature** (session kinds).
   - [ ] Add `setWorkingGlossFromString` beside `setWorkingShortNameFromString`, and a `WorkbenchGlossField` as the second instantiation. Label "Gloss". The helper text says it is a reasoning-only physical description that players never see. A single line is enough.
   - [ ] Extend `prepareComponentForFlush` with `withGloss(normalizeOptionalLiteral(component.gloss))`. This is kind-agnostic, because `withGloss` does nothing on non-hosts.
   - [ ] Place the field directly under `WorkbenchShortNameField` in `RoomEditor`, `AreaEditor` and `FeatureEditor`. Knowledge, Guidance and Lens don't get it, since they have no gloss.
   - [ ] Tests:
      - a field test that mirrors `WorkbenchShortNameField.test.tsx` (renders, edits `working`, respects readonly);
      - `workbenchMutations.test.ts` flush cases (trimmed; whitespace-only becomes absent; unchanged on components with no gloss);
      - a payoff test that ends at the flushed component's WML text carrying `<Gloss>`, not at `working.gloss`.
3. [ ] **`Gloss` on Character** (asset-mode sibling).
   - [ ] Add a `LiteralGlossField` beside `CharacterEditor`'s `LiteralShortNameField`, with the same debounced `updateStandard` pattern. Normalize at set time (trim, empty becomes `undefined`) using the same helper, since this path skips `prepareComponentForFlush`.
   - [ ] Test: editing the field reaches the committed `StandardCharacter`'s WML as `<Gloss>`. Clearing it removes the tag.
4. [ ] **Minimal `ObjectEditor`** (WG-1, WG-2).
   - [ ] Add `ObjectEdit/ObjectEditor.tsx` on `WorkbenchComponentProvider`, with a `StandardObject` guard, `WorkbenchShortNameField` and `WorkbenchGlossField`.
   - [ ] In `WorkbenchAssetEditor`, route `StandardObject` to `ObjectEditor` instead of `<Box />`.
   - [ ] Reachability (WG-1): add Object to `isTopLevelAssociable`, `TAG_ICONS` and `ADD_OPTIONS`, and to the `AddComponentTag` union. Check that `componentTagFromUniversalKey` and `standardComponentFactory` accept an `OBJECT#` key.
   - [ ] Default ShortName (WG-2): `materializeComponent` seeds `object` on a new Object. The flush is unchanged.
   - [ ] Tests:
      - routing (an Object component renders `ObjectEditor`);
      - `materializeComponent.test.ts`: a new Object carries ShortName `object`, and other kinds are unchanged;
      - a payoff test: Add Object from the asset root, then edit the Gloss. It ends at the Object's WML carrying `<ShortName>object</ShortName>` and `<Gloss>` and re-parsing cleanly;
      - clearing the Object's ShortName flushes WML with no `<ShortName>` that still re-parses. This relies on slice 0.
5. [ ] **Docs and close.**
   - [ ] Update [`Workbench/AGENT.md`](../../charcoal-client/src/components/Workbench/AGENT.md):
      - the Key Files table (the shared literal field, `WorkbenchGlossField`, `ObjectEdit/`);
      - "Session-bound field components";
      - the `WorkbenchAssetEditor` routing list under "System Relationships".
   - [ ] Replace "No authoring UI yet (ISS8187)" in [`mtw-wml components AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) with a pointer to the Workbench fields.
   - [ ] Record WG-2's default ShortName for a new Object in `Workbench/AGENT.md` (under consistency / materialize), and remove the WG rows here.
   - [ ] File follow-ups for Object placement and prose, if they aren't already tracked.
   - [ ] Run a graduation sweep: grep `taskPlanning/` and the repo for links to this file, then delete it.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../AGENT.md).
2. Read [`Workbench/AGENT.md`](../../charcoal-client/src/components/Workbench/AGENT.md): the component session's two tiers, session-bound fields, and the asset-level `updateStandard` exceptions (Character).
3. Read mtw-wml's `Gloss` rules: [`components/AGENT.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.md) ("Literal-field factory: `ShortName` and `Gloss`") and [`components/AGENT.implementation.md`](../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (the `gloss` section, and `StandardObject`'s required ShortName).
4. Read [`AGENT.architecture.codeOrganization.md`](../../AGENT.architecture.codeOrganization.md). Slice 1 applies its sibling-and-factory precedent on the client side.
5. Testing authority:
   - `charcoal-client`: [`AGENT.development.md`](AGENT.development.md), then [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md). The client uses Vitest, not Jest flags.
   - `mtw-wml` (slice 0): [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md) (Jest).
   - `lambda/ephemera` (slice 0's downstream check): [`lambda/ephemera/AGENT.testing.md`](../../lambda/ephemera/AGENT.testing.md). Integration tests (`*.integration.test.ts`) sit outside `tsconfig`, so run the suite, not just `tsc`.
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
- Slices 1-4: the `charcoal-client` baseline commands. `npm run check` must report no new errors.
- Slice 1: no test edits. A no-behaviour slice that needs test edits has changed behaviour.
- Slices 2-4: the new tests named in each slice. Payoff tests end at WML text (the observable authoring output), not at `working`.
