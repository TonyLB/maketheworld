# Reasoning gloss

**Status:** Slice 2 shipped 2026-09-25. Next: slice 3 (`Gloss` in WML for the five kinds).

This plan is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../../AGENT.md). It is an implementation plan.

## Why

LLM reasoning about things in the world keeps needing a short factual description of them, for reasoning rather than display: "a red tin cup, fist-sized, light". Five consumers across four [adjudication layers](../../actions/AGENT.objectManipulationIterations.planning.md#adjudication-layers-2026-09-24) want it:
- judging a challenge ([`AGENT.commandAttemptPhase.planning.md`](../../actions/AGENT.commandAttemptPhase.planning.md)'s CA-1);
- detecting world-knowledge challenges (CA-6; corpus rows 2 and 5);
- narration manner (CA-4);
- telling apart referents that share a name (rows 10 and 11, two bottles);
- facts a short name hides.

**The render `Summary` / `Description` facets are the wrong source.** They are player-facing, depend on the situation, and are written as flavour. Using them for reasoning would tie two jobs together that change for different reasons.

This plan builds the field's **shape**, from WML through Assets to Ephemera's `ludicCache`, for the five kinds the cache holds (Character, Object, Room, Feature, Area). It does not build authoring UI; that is a separate issue. Nothing generates a gloss until slice 6.

**Downstream:** the first LLM readers of the attempt prose wait for slice 5: the attempt plan's slice 4 (CA-6) and iteration 2's fallback steps 1 and 3. The attempt plan's format (CA-1) and its slices 0-3 do not, since the gloss is optional in the prose.

## Design (settled 2026-09-24)

- **One gloss per thing, describing the thing as introduced.** It is global, like `shortName`, not per situation. It may include facts play can change (colour, fullness). Nobody sorts facts into essential and changeable up front, because that would assume a closed list of verbs.
- **State overrides it.** A `red tin cup` with a `painted blue` state is blue, and a later override beats an earlier one. The LLM reading the prose resolves the conflict from a convention (gloss first, then current state, marked as superseding the gloss), not code: for code to know which gloss facts an override replaces, it would need a property schema. A new verb adds a kind of state and never touches a gloss. **Known gap:** no state axis exists yet (`markState` is hardcoded `[]`), so overrides have no home today. That doesn't block the gloss.
- **Rewritten only at identity events**: authoring edits, improvisation updates, and divide/merge (the iterations plan's "Separability and merger" entry has to define those anyway). Never at a play-time mutation. Whether a change is a state override or an identity event (a crushed cup versus one melted into a lump) is a soft line, and getting it wrong costs little, since the prose describes the thing correctly either way.
- **Stored like `shortName`: a component field.** A gloss on the component comes back in the same merged read that already resolves `shortName`, so putting it on the `ludicCache` node costs no extra I/O, however rarely it is read. An improvised object's body is a `StandardComponent` too, so the one field serves authored and improvised things alike.
- **Authorable or improvisable.** An authored gloss wins. Otherwise one is improvised at write time (slice 6). Best-effort, and absence is valid, as with `EMBEDDING#IMPROMPTU`; unlike the embedding, it is not attached by a separate pass from its own row. Until the UI issue ships, authoring means writing `<Gloss>` in WML source.
- **Distinct from [AB-37](../AGENT.abstractionLayers.planning.md)'s reasoning summaries.** AB-37's example, "a long thread winding through many rooms", is a *projection* over position and relations, which is why it goes stale. The gloss is *identity*. A composed whole could carry both.

## Premises checked against code (2026-09-24)

- **Every cache kind already has `shortName` in WML.** Character, Object, Room, Feature and Area (and Knowledge, Map, Message, Moment, Situation) declare `shortName?: StandardEditableData<string>` in [`standardize/components/dataTypes/`](../../../../../../packages/mtw-wml/ts/standardize/components/dataTypes/). The cache's node kinds are the `EphemeraLudicGraphComponentNode` union in [`ephemeraMeta.ts`](../../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts).
- **Ephemera resolves `shortName` for objects only.** [`shortNameFromComponent`](../../../../../../lambda/ephemera/dataSource/objects/objectShortName.ts) checks `instanceof StandardObject`, and [`fold.ts`](../../../../../../lambda/ephemera/dataSource/positions/ludicCache/fold.ts)'s `componentCacheNode` falls back to the node's id for every other kind ("a recorded gap, not a design decision"). The merged read beneath it (`shortNameFromMergedAggregate`) is keyed only on `universalKey`, so it works for any kind. The `ASSET#IMPROVISATION` fallback applies to objects only.
- **`ludicCache` is rebuilt per catalog request, which means every command.** `buildLudicCache` resolves names concurrently across hosts; [`ludicCacheInstrumentation.ts`](../../../../../../lambda/ephemera/dataSource/positions/ludicCache/ludicCacheInstrumentation.ts) logs each rebuild's shard count and wall time.
- **Assets stores components whole.** Component rows are standardized NDJSON lines parsed by `standardComponentFactory` ([`dynamoStandardComponents.ts`](../../../../../../packages/mtw-gateways/ts/assets/components/componentData/dynamoStandardComponents.ts)); no field projections were found on component reads. The asset-level `shortName` / `summary` in `lambda/assets/dataSource/caching/cacheAsset.ts` is the asset *header*, unrelated.
- **A WML field touches about 12 places per component class.** For `shortName` in [`object.ts`](../../../../../../packages/mtw-wml/ts/standardize/components/object.ts): constructor, `fromJSON`, the standardize consumer, getter, `toJSON`, schema children, `merge`, `invert`, `isEmpty`, `equals` (and in `room.ts`, a request-type filter). The field logic is factored into [`shortNameField.ts`](../../../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts), whose only ShortName-specific content is the tag name. The schema side is a `literalTagFactory('ShortName')` converter plus per-tag allowed children in [`schema/converters/components.ts`](../../../../../../packages/mtw-wml/ts/schema/converters/components.ts).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| RG-1 | **Which name a Character's cache node carries.** Resolved: `shortName` only, same as every other kind. `displayName` is a render-facing field (`charcoal-client`'s `componentDisplayLabel.ts` falls back to it there); using it for a reasoning-facing cache node would perpetuate a render/reasoning crossover this plan exists to avoid, not extend. `CHARACTER#` ids need no special-casing in the merged read: `shortNameFromMergedAggregate` is keyed only on `universalKey`, independent of which asset stack (room's or player-library) the component came from, so generalizing the resolver in slice 1 resolves Character the same way as any other kind. | 1 | Resolved 2026-09-24 |
| RG-2 | **`Gloss` text rules.** Resolved, as leaned: optional on every kind; trimmed; an empty `Gloss` is treated as absent rather than an error (unlike Object's required, non-empty `ShortName`); plain text only, no render markup. | 3 | Resolved 2026-09-24 |

## Recommended order

Mark pending work `[ ]` and completed work `[X]`, including nested lines, as each one is done.

1. [X] **`shortName` for every cache kind** (Ephemera only; RG-1). Shipped 2026-09-25.
   - [X] Generalize `shortNameFromComponent` / `resolveObjectShortName` to any component that carries a `shortName` (a `resolveComponentShortName`). **Scope grew, with sign-off:** the `ASSET#IMPROVISATION` fallback turned out to be dead duplication (the merged aggregate already routes `ASSET#IMPROVISATION` through the same ephemeraDB pair-row table via `EphemeraComponentDataCompositeCache`), so it was removed rather than generalized --- see `objectShortName.ts`'s new doc comment. Two call sites (`resolveRelationalPresentationLabels.ts`, `resolveObjectMovePresentationLabels.ts`) keep a narrowed version of the fallback for their genuinely distinct null-perspective case, where the aggregate is never attempted at all.
   - [X] Remove `componentCacheNode`'s id-placeholder branch in `fold.ts`, and its doc comment's "recorded gap".
   - [X] Replace `catalogHandles.ts`'s "`shortName === universalKey` means unresolved" sentinel with a real one: `EphemeraLudicCacheNode.shortName` is now `shortName?: string`, and unresolved is genuinely `undefined` (no more coincidental equality inference). `isEphemeraLudicCacheNode` widened to match.
   - [X] Tests: `fold.test.ts` gained two payoff cases --- a room/feature/object walk, and a character-seeded cache (a character present as another host's *member* is never walked, per `enumerateShards.ts`'s "never recursed into" guard, unrelated to this slice; the seed itself always is). All prior tests updated for the dropped `getImprovisationObject` dep and the optional-`shortName` sentinel change; full `lambda/ephemera` suite green (2972 tests).
   - [X] Wall-time: not measured live (no dev-room access this session); analytically, one DB read per object was removed (the dead fallback), so `logLudicCacheRebuild`'s per-object cost should improve, not regress. `ludicCacheInstrumentation.ts`'s doc comment corrected accordingly.
2. [X] **Literal-field factory** (`mtw-wml`; no behaviour change). Shipped 2026-09-25.
   - [X] Parameterize `shortNameField.ts` by tag, so `ShortName` becomes one use of a literal-field factory. New `literalFieldFactory(tag, fieldName)` in [`literalField.ts`](../../../../../../packages/mtw-wml/ts/standardize/components/literalField.ts), the standardize-side counterpart to `mtw-base`'s schema-side `literalTagFactory`. `shortNameField.ts` is now a thin instantiation (`literalFieldFactory('ShortName', '_shortName')`) re-exporting the same six functions and one typeguard under their original names; none of the 12 importing component files changed.
   - [X] Every existing `shortName` test stays green unchanged. `shortNameField.test.ts` untouched; full `mtw-wml` suite green (2064 tests), plus `tsc -p packages/mtw-wml/tsconfig.json --noEmit` clean.
3. [ ] **`Gloss` in WML for the five kinds** (`mtw-wml`; RG-2).
   - [ ] Schema: a `Gloss` literal tag via `literalTagFactory`, its typeguard and `SchemaTag` entry, and allowed as a child of `Character`, `Object`, `Room`, `Feature` and `Area` in `schema/converters/components.ts`.
   - [ ] Standardize: the second use of the slice 2 factory, wired into the five component classes at every place `shortName` is.
   - [ ] `dataTypes`: `gloss?: StandardEditableData<string>` and its typeguard key on the five.
   - [ ] Tests as WML text, in the style of `shortNameRoundTrip.test.ts`: parse, print, merge, invert and equality for each kind; one case per RG-2 rule.
4. [ ] **Assets round trip** (`mtw-gateways` / `lambda/assets`). Expected: no code change.
   - [ ] One test: an asset whose component carries `<Gloss>` is cached and comes back through the merged component aggregate with the gloss intact. If it doesn't, the fix goes where it fails, and this slice grows.
5. [ ] **Ephemera: gloss on the cache node.**
   - [ ] `glossFromComponent` beside `shortNameFromComponent`; one resolver returns both from the same merged read.
   - [ ] `gloss?: string` on `EphemeraLudicCacheNode`, and its runtime typeguard in `types.ts`.
   - [ ] Payoff test: a room whose authored WML gives an object and a feature a `<Gloss>` builds a `ludicCache` whose nodes carry those glosses. Not the render wire: the gloss isn't render data.
6. [ ] **Improvised glosses.** Waits on slice 0 of [`AGENT.commandAttemptPhase.planning.md`](../../actions/AGENT.commandAttemptPhase.planning.md) finding a corpus row that short names can't decide (rows 10 and 11 are the likely first). Scope it then: the gloss in the improvised object's merge body (`persistImprovisationObject.ts`), generated by the Acme enrich call that already runs at spawn; whether it also feeds the embedding (so Identify can resolve "the heavy bottle"); and whether authored things without a gloss get an improvised one in the improvisation layer (unverified: whether an overlay on an *authored* object is supported).
- [ ] **Open the authoring-UI issue**: `<Gloss>` in the Workbench editor for the five kinds. Confirm with the user before posting.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../../AGENT.md).
2. Read [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../../../packages/mtw-wml/ts/standardize/components/AGENT.md) (component classes) and [`positions/ludicGraph/AGENT.md`](../../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) (node model).
3. Testing authority:
   - `mtw-wml`: [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md). It also says `charcoal-client`'s build must not report errors from `mtw-wml`, which matters for slice 3's new tag.
   - `mtw-gateways`: [`packages/mtw-gateways/AGENT.md`](../../../../../../packages/mtw-gateways/AGENT.md) (Jest, from the package root).
   - `lambda/ephemera`: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). Integration tests (`*.integration.test.ts`) sit outside `tsconfig`, so run the suite, not just `tsc`.
   - If commands conflict, follow those files.
4. Baseline, which should pass before any edit (from the repo root):

```bash
npm --prefix packages/mtw-wml run test -- --watchAll=false --testPathPattern="shortName|object|room|character|feature|area"
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicCache/ dataSource/objects/ dataSource/actions/roomObjectCatalogForCharacter
```

## Verification

- Slice 1: the `lambda/ephemera` baseline command above, plus the new cache test.
- Slice 2: the `mtw-wml` baseline command, with no test edits. A no-behaviour slice that needs test edits has changed behaviour.
- Slice 3: the `mtw-wml` baseline plus the new round-trip tests, and a `charcoal-client` build with no errors from `mtw-wml`.
- Slice 4: `npm --prefix packages/mtw-gateways run test`, plus the `lambda/assets` suite if the test lands there.
- Slice 5: the `lambda/ephemera` baseline. The payoff test ends at the built `ludicCache`, which is this plan's observable output until a consumer (the attempt plan) reads it.

## When done

Graduate the Design section before deleting this plan: the field's rules to [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../../../packages/mtw-wml/ts/standardize/components/AGENT.md), and the reasoning use (state overrides the gloss; the prose convention) to `lambda/ephemera`'s `positions/ludicCache` docs or `actions/AGENT.concepts.md`, whichever the attempt plan's slice 1 settles as the attempt vocabulary's home. Then repoint the links into this file from the iterations plan, the attempt plan and AB-37.
