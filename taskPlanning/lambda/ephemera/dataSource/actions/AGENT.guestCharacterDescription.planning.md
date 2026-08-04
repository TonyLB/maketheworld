# Guest character descriptions (follow-on to render-host iteration 10)

**Status:** Scoped through conversation 2026-08-03. Nothing built yet. Branch `iss8074-guest-character-description`.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Predecessor (shipped): [`AGENT.objectCharacterRenderHosts.planning.md`](AGENT.objectCharacterRenderHosts.planning.md) --- that iteration made Character a real render-cache host; this one gives *guest* characters something to render.

## Purpose

The Coyote Game is most players' first contact with MTW, so most characters in play are guests. Iteration 10 shipped the Character render path, but it renders only what `ensureAuthoredCatalog` can merge --- an authored `SITUATION#DEFAULT` `<Example>` facet. A guest character has `assets: []` and appears in no authored WML, so `look <guest>` renders an empty Character today.

Guests should look like scraggly cartoon coyotes.

## Design decision (confirmed through conversation, 2026-08-03)

**Assign the description as data at the guest seam; do not hard-code prose in `renderCache`.**

The render path is deliberately kind-agnostic and provenance-agnostic --- iteration 10's own decision, *"Authored vs. generated is orthogonal to component kind; do not build kind-specific provenance assumptions into the facet shape."* A coyote string embedded in the cache path would special-case one kind inside the one layer that is supposed to stay symmetric.

The shape to copy is **Phase 5 for Object**: generated prose is written to a `(componentId, ASSET#IMPROVISATION)` pair row at creation time, participates in the ordinary merge, and is authored-equivalent by render time. `ASSET#IMPROVISATION` is the established "runtime-generated content" merge layer, not an Object-only mechanism.

## Findings from the current code (2026-08-03)

- **One seam, not two.** [`guestCharacter/index.ts`](../../../../../lambda/ephemera/guestCharacter/index.ts)'s `confirmGuestCharacter` is *both* make-guest and repair-guest --- an idempotent `Meta::Character` upsert fired from [`app.ts:159`](../../../../../lambda/ephemera/app.ts#L159). Guest *id/name* allocation lives separately in [`lambda/assets/player/heal.ts`](../../../../../lambda/assets/player/heal.ts)'s `healPlayer`, which does not touch ephemera. Only `confirmGuestCharacter` needs to change.
- **There is already a coyote string --- and it is dead.** `confirmGuestCharacter` writes `Description: 'A scraggly coyote with a hungry and cunning look in his eye.'` onto `Meta::Character` under `coyoteGameEnabled`. Nothing reads it: it is absent from `internalCache/characterMeta.ts`, from `mtw-interfaces/ts/ephemeraMeta.ts`, and from the client. It predates the render path and is not the mechanism to extend. (Note it also says *his* while `Pronouns` is `they/them`.)
- **The pair-row read path already generalizes.** [`componentData/fetch.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentData/fetch.ts) derives tag via `componentTagFromUniversalKey`, so a `CHARACTER#` pair row reconstructs as `StandardCharacter` with no change --- the same thing Phase 5 verified for Object in `componentData/index.test.ts`.
- **No bare-row hazard; Character is not Object here.** Object needed a U+2060 placeholder because `<Object>`'s *schema content model* requires exactly one non-empty `<ShortName>`. Character's converter is unrestricted, and iteration 10 already shipped `EMPTY_CACHE_RENDERED_CONTENT` in [`characterRenderWmlFromCacheRecord.ts`](../../../../../lambda/ephemera/dataSource/perception/characterRenderWmlFromCacheRecord.ts) --- a Character row carrying only `universalKey` round-trips through `schemaToWML` today. Separately, `StandardCharacterData` has an optional `shortName`, so the guest pair row writes it anyway (= the guest `Name`), mirroring Object's pair row and keeping the row self-describing.
- **Merge participation is the one real gate.** [`ensureAuthoredCatalog.ts:96-99`](../../../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts#L96-L99) appends `ASSET#IMPROVISATION` only when `isEphemeraObjectId(componentId)`, and [`appendImprovisationToPerspective`](../../../../../packages/mtw-interfaces/ts/perspective.ts#L62) types its scope argument as `EphemeraObjectId[]` (using it only as a non-empty flag). Without widening both, a Character pair row is written, hydrate "succeeds" having found nothing, and no `CACHE#` row appears --- the exact silent failure iteration 10's Phase 5 follow-on gap (3) describes. See [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) **Improvisation merge participation**.

## Explicit non-goals

- **Per-guest generated variation.** One shared static prose slice for all guests to start; a Bedrock call at guest-confirm time is a later, separable step if the sameness grates.
- **Non-guest character descriptions.** Authored characters already have the authored path.
- **Referent resolution.** Still deferred from iteration 10: `look <character>` as *text* does not resolve. Prove this via trusted-UI click, as RH-4 did.

## Getting started

1. Read the predecessor plan's Phase 5 and its **Phase 5 follow-on** paragraph --- gaps (3) and (4) there are the two failure modes this plan is most likely to repeat.
2. Read [`persistImprovisationObject.ts`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts) --- `pairRowFromShortName` / `persistSpawnImprovisationObject` are the write shape to mirror, including the "preserve prior `situations` unless explicitly overridden" correctness fix.
3. Read [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) **Improvisation merge participation** before touching `ensureAuthoredCatalog`.
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Jest in all affected packages (`npm run test`). **Integration tests sit outside `tsconfig`** --- `npx tsc --noEmit` will not catch a broken `*.integration.test.ts`; run the suite.
5. Baseline (should pass before edits):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false guestCharacter/ dataSource/renderCache/
cd packages/mtw-gateways && npm run test -- --watchAll=false componentData
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines as each sub-step lands. Nothing below is built yet.

- [ ] **Phase 1. Widen improvisation merge participation to `CHARACTER#` hosts.**
  - [ ] `appendImprovisationToPerspective`'s scope parameter accepts `EphemeraObjectId | EphemeraCharacterId` (it is a non-empty flag, not a lookup key --- no behavior change beyond the type).
  - [ ] `ensureAuthoredCatalog`'s `runStaleHydratePath` appends for Character hosts as well as Object; update the explanatory comment there and the `renderCache/AGENT.md` section, both of which currently say "Object" normatively.
  - [ ] Unit test: a `CHARACTER#` host's `mergeParticipationOrder` ends in `ASSET#IMPROVISATION`; a `ROOM#` host's does not.
- [ ] **Phase 2. Write the guest facet at `confirmGuestCharacter`.**
  - [ ] Add a guest-prose module holding the coyote `SITUATION#DEFAULT` slice (pronoun-correct: `they/them`, matching the row it ships beside). One exported constant, `coyoteGameEnabled`-gated at the call site, not inside the constant.
  - [ ] Write `(CHARACTER#<guestId>, ASSET#IMPROVISATION)` with `{ tag: 'Character', shortName: <guest Name>, situations: [...] }` alongside the existing `Meta::Character` upsert. Idempotent: repair overwrites, so a prose edit reaches existing guests on their next confirm. **Write `situations`, not `render`** --- `render` is the output field `characterRenderWmlFromCacheRecord` synthesizes from the resolved cache record, one layer downstream of the merge body.
  - [ ] Invalidate on write --- `internalCache.ImprovisationComponentData` / `ComponentData` for the pair, plus existing `CACHE#`/catalog rows for that `CHARACTER#`, or a repaired guest keeps serving stale/empty prose. `invalidateImprovisationObjectCaches` is Object-specific; do **not** widen it blindly --- check which of its steps (room-scoped invalidation, embedding) are meaningless for a Character before reusing or forking it.
  - [ ] Delete the dead `Description` field from the `Meta::Character` upsert once the facet supersedes it.
- [ ] **Phase 3. Payoff test terminating at observable output.**
  - [ ] Integration-shaped test: guest confirm -> `look` at that guest -> asserted on the **rendered prose a player would see**, not on the merged `StandardCharacter`. This is the explicit lesson from iteration 10's follow-on; an assertion that stops at the last internal representation is not the payoff test.
  - [ ] Live smoke: create a guest, trusted-UI click the guest in a room roster, confirm coyote prose renders.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| GD-1 | Does an existing guest's pair row get rewritten on every confirm, or written only when absent? | Phase 2 | **Decided (2026-08-03): rewrite on every confirm.** While the prose is a static shared constant there is nothing on the row worth preserving, and rewriting means a prose edit propagates to every existing guest on their next confirm --- repair *is* the migration path. Revisit only if per-guest generated prose lands, which would give the row content that repair must not clobber (cf. `persistUpdateImprovisationObject`'s preserve-prior-`situations` fix). |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  guestCharacter/ dataSource/renderCache/ dataSource/renderOrchestration/ dataSource/perception/
cd packages/mtw-gateways && npm run test -- --watchAll=false
cd lambda/ephemera && npx tsc --noEmit
cd packages/mtw-interfaces && npx tsc --noEmit
```

Plus end-to-end: a freshly created guest, looked at via trusted-UI click, renders coyote prose.

## Progress

| Milestone | Status |
| --- | --- |
| Scope + design confirmed through conversation | Done (2026-08-03) |
| Phase 1 (Character improvisation merge participation) | Not started |
| Phase 2 (guest facet write at `confirmGuestCharacter`) | Not started |
| Phase 3 (payoff test + live smoke) | Not started |
