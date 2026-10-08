# Characters data source: `mtw.ephemera.characters`, with the eviction ladder as first tenant

**Status:** Slices 0--1 done. **Next:** Slice 2 (read-side safety and the payoff test).

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../AGENT.md). It is an **implementation plan**, not a design-stage one.

## Goal

Give character play state an owning DataSource, the way [`mtw.ephemera.objects`](../../../../lambda/ephemera/dataSource/objects/AGENT.md) owns object play state while placement stays with positions. Its four-way split already says it "mirrors Character"; the character side has the split but no owner.

**First tenant: the eviction ladder (`Meta::Character.RoomStack`).** The ladder answers a question about the character's asset access, and its maintenance is already shaped like a subscriber: it runs after commit, beside presentation, tolerates failure, and merges by timestamp so late writes cannot regress newer frames. Today it is an inline call in positions' [`orchestrateCharacterMove`](../../../../lambda/ephemera/dataSource/positions/navigate/orchestrateCharacterMove.ts). After this plan, the characters DataSource maintains it by subscribing to positions' **`Character Moved`**, and positions only **reads** it to resolve legal placement (connect, asset loss).

**Payoff test (observable output, not intermediate shape):** a character navigates into an overlay-asset room, disconnects, and reconnects, and is **placed** in that room; after the overlay asset becomes inaccessible, reconnect **places** them at the surviving canon frame. The ladder write must arrive through the real in-process bus subscription, not a direct call.

**Out of scope:** ownership of the character body fields (`Name`, `Color`, `Pronouns`, `assets`, ...) and the cross-lambda writer of them; converging character moves onto the generic `commitAndPresentStepSequence` composer (this plan removes the reason it can't, not the divergence itself); any `mtw-interfaces` or `mtw-gateways` surface. Each is recorded at close (see Slice 3). **`internalCache.CharacterMeta` stays in `lambda/ephemera/internalCache/`** (as `ObjectEphemeraMeta` does for objects): a gateway is for rows read by a lambda other than their owner's, and every `CharacterMeta` reader is in ephemera, which will own the row. It gets a gateway when another lambda first needs character play state.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) once for the durability split.
2. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow it. Jest; run from `lambda/ephemera` with `npm run test` (not `npm test`).
3. Baseline before edits (from `lambda/ephemera`): `npm run test -- --watchAll=false`. Note: `*.integration.test.ts` files sit outside `tsconfig`, so `tsc` alone misses them --- always run the full suite after a move or rename, and grep module paths, not just symbols.
4. Read, in order:
   - The ladder's concept, rules and code map: [concepts --- Eviction ladder](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#eviction-ladder), [contract --- Eviction ladder](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#eviction-ladder-roomstack-storage), [implementation --- Eviction ladder](../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#eviction-ladder-roomstack-storage).
   - The precedent: [`objects/AGENT.md`](../../../../lambda/ephemera/dataSource/objects/AGENT.md) (field split by owner) and [`narration/index.ts`](../../../../lambda/ephemera/dataSource/narration/index.ts) (smallest bus-only subscriber: `publisherStrategy: 'busOnly'`, `replayable: false`).
   - The DataSource pattern: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) --- bus-only DataSources colocate outgoing payload types in `publishedEvents.ts` and need nothing in `mtw-interfaces`.

### Grounding facts (verified 2026-10-08)

**Delivery is in-process.** Positions is `busOnly`, so `Character Moved` reaches subscribers on the same invocation's message bus, not via EventBridge. The staleness window between commit and ladder write is therefore about as small as today's `Promise.all` tail, not an EventBridge delay. Narration subscribing to actions' `Character Spoke` is the precedent for one ephemera DataSource consuming another's bus-only fact.

**The fact carries the write's inputs.** [`CharacterMovedPublishedPayload`](../../../../lambda/ephemera/dataSource/positions/publishedEvents.ts) has `characterId`, `to` and `beatAnchorTime`. The remaining inputs to `persistRoomStackNavigate` (character assets, room assets, canon assets) are cache reads.

**Coverage widens for free.** `Character Moved` is emitted both by membership apply and by the kernel's [`commitStepSequence`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts); today only the `orchestrateCharacterMove` route maintains the ladder.

**`RoomStack` touchpoints (all inside `lambda/ephemera`):**

| File | Role | After this plan |
| --- | --- | --- |
| `positions/manipulation/membership/membershipRoomStack.ts` | Navigate algorithm (extend / rewrite tail / fork) | Moved to `characters/roomStack/` (Slice 1) |
| `positions/manipulation/membership/mergeRoomStack.ts` | Timestamp merge | Moved to `characters/roomStack/` (Slice 1) |
| `positions/manipulation/membership/persistRoomStackNavigate.ts` | Navigate persist | Moved to `characters/roomStack/`; called by `characters/handleCharacterMoved.ts` (Slice 1) |
| `positions/manipulation/membership/trimEvictionLadder.ts` | Trim, normalize, `DEFAULT_ROOM_STACK` | Moved to `characters/roomStack/`, now also holding `resolveLegalRoomIdFromRoomStack` (Slice 1) |
| `positions/manipulation/membership/types.ts` `RoomStackItem` | Frame type | Moved to `characters/roomStack/types.ts` (Slice 1) |
| `positions/manipulation/membership/trimPersistCharacterRoomStack.ts` | Trim-only persist at connect / asset loss | Moved to `characters/roomStack/`, exported; positions calls it (precedent: objects calls positions' `executeMembershipTransfer` directly) (Slice 1) |
| `positions/manipulation/membership/resolveCharacterRoomId.ts`, `resolveConnectTargetRoom.ts`, `repairCharacterLegalPlacement.ts` | Read-side resolution: trim, top frame, move | Stay in positions; `resolveLegalRoomIdFromRoomStack` moved out to characters' `trimEvictionLadder.ts`, since `trimPersistCharacterRoomStack` needs it and characters must not import positions' read side |
| `positions/navigate/orchestrateCharacterMove.ts` | Inline ladder write in `Promise.all` | Write, asset-getter args and docblock carve-out removed (Slice 1) |
| `positions/publishedEvents.ts` | Had no `Character Moved` envelope guard (only an inline header check) | Exports `isEphemeraPositionsCharacterMovedEnvelope`, used by `isEphemeraPositionsOutboundEnvelope` and characters' `subscribedEvents.ts` (Slice 1) |
| `internalCache/characterMeta.ts` | Reads `RoomStack`; imported `DEFAULT_ROOM_STACK` **from positions** | Imports from characters; legacy `RoomId` dropped (Slice 1) |
| `guestCharacter/index.ts` | Wrote `RoomStack` on every guest confirm (`Player Connected`) | Imports from characters; sets `RoomStack` only when absent (Slice 1) |

`affordanceOrchestration/fanOutAffordanceRefreshForRoom.ts` and `renderOrchestration/fanOutStateChangedToPassiveRenders.ts` match a `RoomStack` grep but use the **room asset stack** (`resolveRoomAssetStackForRoom`), which is a different thing. Leave them alone.

**Known `Meta::Character` writers outside the ladder:** [`lambda/updateEphemera/app.ts`](../../../../lambda/updateEphemera/app.ts) (separate lambda, invoked by the Heal step function: `assets`, `Color`, `Name`, `player`, `pronouns`, `RoomId`, `Description`); [`guestCharacter/index.ts`](../../../../lambda/ephemera/guestCharacter/index.ts) `confirmGuestCharacter`, run by the [`mtw.ephemera.players`](../../../../lambda/ephemera/dataSource/players/index.ts) DataSource on every `Player Connected` (`Name`, `Pronouns`, `Color`, `assets`, `RoomStack`, `player`); positions' [`ludicGraph/index.ts`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) and objects' [`persistClearStoredLudicGraphs.ts`](../../../../lambda/ephemera/dataSource/objects/persistClearStoredLudicGraphs.ts) (`ludicGraph`, which stays with positions, like object placement). The full map is below.

### `Meta::Character` field ownership (Slice 0, verified 2026-10-08)

The scope rule, the field-ownership table and the open findings (2, 3, 4, 6) now live in [`characters/AGENT.md`](../../../../lambda/ephemera/dataSource/characters/AGENT.md#metacharacter-field-ownership). Findings 1 (guest ladder reset) and 5 (legacy `RoomId`) were fixed in Slice 1.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **CH-1** | **Asset-loss relocation trigger.** [`repairCharacterLegalPlacement`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/repairCharacterLegalPlacement.ts) relocates when the trimmed ladder's top frame differs from current membership. That comparison assumes the ladder is current; once it is maintained by a subscriber, a lagging ladder would trigger a false move back to the previous room. Relocate when the **current room's** asset is no longer accessible (which is what asset loss means), and use the ladder only to choose the destination. The function has no live caller (its asset-visibility ingress is future work), so the change is cheap now. | Slice 2 | Settled |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 0 --- `Meta::Character` field-ownership inventory.**
  - [X] Grep every reader and writer of `Meta::Character` across `lambda/` and `packages/` (not just ephemera; known hits include `connections`, `diagnostics`, `assets`, `subscriptions`, `chaos`, `updateEphemera`). Search by key string and by `CharacterMeta` / `CharacterMetaItem` use.
  - [X] Build a table in this plan: field -> writers -> readers -> proposed owner (`characters`, `positions`, or unclaimed). Model it on the objects four-way split table. See [`Meta::Character` field ownership](#metacharacter-field-ownership-slice-0-verified-2026-10-08).
  - [X] Record findings that are not this plan's work, with a home: notably the legacy `RoomId` field (positions concepts says it is neither written nor read as truth; in fact `updateEphemera` writes it, `chaos/addGhostSession` reads it, `CharacterMetaItem` still carries it, and `mtw-gateways`' [`getCharacterRoomIdFromDynamo`](../../../../packages/mtw-gateways/ts/ephemera/positions/fetch.ts) still reads it --- exported, with no caller), and `updateEphemera` writing body fields from another lambda.
  - [X] Settle CH-2 (row removed; its rule is the inventory's scope rule).
- [X] **Slice 1 --- scaffold `mtw.ephemera.characters` and move the ladder.**
  - [X] New `lambda/ephemera/dataSource/characters/` from the narration template: `index.ts` (`busOnly`, `replayable: false`), `subscribedEvents.ts` (guard for positions' `Character Moved`; positions had none, so `isEphemeraPositionsCharacterMovedEnvelope` was added to `positions/publishedEvents.ts`), `publishedEvents.ts`, `AGENT.md`.
    - [X] `AGENT.md` carries the scope rule and the field-ownership table from Slice 0 (its durable home), modeled on objects' four-way split.
  - [X] `confirmGuestCharacter` writes `RoomStack` only when absent, with a test that a guest reconnect keeps a non-default ladder (Slice 0 finding 1).
  - [X] Retire legacy `Meta::Character.RoomId` (Slice 0 finding 5; positions' "neither written nor read" stance is the authority):
    - [X] [`updateEphemera/app.ts`](../../../../lambda/updateEphemera/app.ts): drop `RoomId` from `updateKeys` and the reducer.
    - [X] [`chaos/addGhostSession`](../../../../lambda/chaos/addGhostSession/index.ts): drop the `RoomId` read and the `Meta::Room.activeCharacters` write it guards. The connectionDB session rows stay.
    - [X] [`internalCache/characterMeta.ts`](../../../../lambda/ephemera/internalCache/characterMeta.ts): drop `RoomId` from `CharacterMetaItem`, the fetch type, the projection, the default and the derivation; update `internalCache/index.test.ts` fixtures.
    - [X] `mtw-gateways`: delete `getCharacterRoomIdFromDynamo` and its export (no caller).
    - [X] Grep check: `rg -t ts "RoomId" lambda/updateEphemera/app.ts lambda/chaos/addGhostSession lambda/ephemera/internalCache/characterMeta.ts` finds nothing, and `getCharacterRoomIdFromDynamo` has no hits.
  - [X] Register in [`app.ts`](../../../../lambda/ephemera/app.ts) and add the row to [`dataSource/AGENT.md`](../../../../lambda/ephemera/dataSource/AGENT.md)'s DataSource table.
  - [X] Move the ladder modules listed under Grounding facts into `characters/` (subfolder name is a free choice). Update every importer, including `internalCache/characterMeta.ts` and `guestCharacter/index.ts`. Done as `characters/roomStack/`; `resolveLegalRoomIdFromRoomStack` moved with `trimEvictionLadder.ts` to avoid a characters -> positions import.
  - [X] Subscriber: on `Character Moved` with `to !== null`, call `persistRoomStackNavigate` with the fact's `beatAnchorTime`; read character, room and canon assets from cache. Keep the failure-tolerance rule (log, never throw).
  - [X] Remove the ladder write from `orchestrateCharacterMove`'s `Promise.all` and delete the docblock carve-out that existed only because of it.
  - [X] Tests: move the ladder unit tests with their modules; add subscriber tests (navigate fact -> write; `to: null` -> no write; persist failure -> logged, no throw); add a duplicate-delivery test (same fact twice -> same stack), which also checks `mergeRoomStack` is idempotent at an equal timestamp.
- [ ] **Slice 2 --- read-side safety and the payoff test.**
  - [ ] Implement CH-1 in `repairCharacterLegalPlacement`, with tests for: current room still accessible -> no move even when the ladder's top differs; current room inaccessible -> move to the trimmed top frame.
  - [ ] Payoff integration test (`*.integration.test.ts`, real bus): navigate into an overlay room -> disconnect -> connect places the character there; remove overlay access -> connect places them at the canon frame.
- [ ] **Slice 3 --- graduate docs and close.**
  - [ ] Positions [contract](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#eviction-ladder-roomstack-storage): keep the read-side rules (trim, top frame, move when the endpoint changes; disconnect purges membership and keeps the ladder; no `Character Moved` for ladder-only change). Move the maintenance rules (navigate merge, trim persist, failure tolerance) to the characters docs. Remove the "navigate ladder timing" rule that names the `Promise.all`, and the "Pending move" bullet that links to this plan.
  - [ ] Move the "Eviction ladder" concept entry to the characters docs; leave positions' graph-roles table pointing to it.
  - [ ] Update [`positions/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) (Eviction ladder section) and [`positions/manipulation/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) (the "RoomStack is not a kernel input" paragraph).
  - [ ] Record the out-of-scope follow-ups where they will be found: character-move convergence onto `commitAndPresentStepSequence` in `positions/manipulation/AGENT.implementation.md`; Slice 0's unclaimed fields and findings 2, 3, 4 and 6 in the characters `AGENT.md` (already moved there in Slice 1; check they still read correctly).
  - [ ] Grep inbound links to every moved section and file before deleting this plan.

## Verification

From `lambda/ephemera`:

```bash
npm run test -- --watchAll=false
# after moving modules or making a shared field required, once:
npm run test -- --clearCache && npm run test -- --watchAll=false
# no ladder module left in positions (Slice 1):
grep -rn "mergeRoomStack\|membershipRoomStack\|persistRoomStackNavigate\|trimEvictionLadder" dataSource/positions
# no positions import from the cache or guest character (Slice 1):
grep -n "dataSource/positions" internalCache/characterMeta.ts guestCharacter/index.ts
```

## Progress

| Slice | Status |
| --- | --- |
| 0 --- ownership inventory | Done |
| 1 --- scaffold and move | Done |
| 2 --- read-side safety, payoff test | Not started |
| 3 --- docs and close | Not started |
