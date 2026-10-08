# Characters data source: `mtw.ephemera.characters`, with the eviction ladder as first tenant

**Status:** not started. **Next:** Slice 0 (the `Meta::Character` field-ownership inventory).

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
| `positions/manipulation/membership/membershipRoomStack.ts` | Navigate algorithm (extend / rewrite tail / fork) | Moves to characters |
| `positions/manipulation/membership/mergeRoomStack.ts` | Timestamp merge | Moves to characters |
| `positions/manipulation/membership/persistRoomStackNavigate.ts` | Navigate persist | Moves to characters; called by the subscriber |
| `positions/manipulation/membership/trimEvictionLadder.ts` | Trim, normalize, `DEFAULT_ROOM_STACK` | Moves to characters |
| `positions/manipulation/membership/types.ts` `RoomStackItem` | Frame type | Moves to characters |
| `positions/manipulation/membership/trimPersistCharacterRoomStack.ts` | Trim-only persist at connect / asset loss | Moves to characters, exported; positions calls it (precedent: objects calls positions' `executeMembershipTransfer` directly) |
| `positions/manipulation/membership/resolveCharacterRoomId.ts`, `resolveConnectTargetRoom.ts`, `repairCharacterLegalPlacement.ts` | Read-side resolution: trim, top frame, move | Stay in positions |
| `positions/navigate/orchestrateCharacterMove.ts` | Inline ladder write in `Promise.all` | Write removed; docblock carve-out removed |
| `internalCache/characterMeta.ts` | Reads `RoomStack`; imports `DEFAULT_ROOM_STACK` **from positions** | Imports from characters (fixes a cache-depends-on-positions inversion) |
| `guestCharacter/index.ts` | Writes initial `RoomStack` on guest creation | Imports from characters; whether the write itself moves is a Slice 0 finding |

`affordanceOrchestration/fanOutAffordanceRefreshForRoom.ts` and `renderOrchestration/fanOutStateChangedToPassiveRenders.ts` match a `RoomStack` grep but use the **room asset stack** (`resolveRoomAssetStackForRoom`), which is a different thing. Leave them alone.

**Known `Meta::Character` writers outside the ladder** (seed for Slice 0, not complete): [`lambda/updateEphemera/app.ts`](../../../../lambda/updateEphemera/app.ts) (separate lambda: `assets`, `Color`, `Name`, `player`, `pronouns`, `RoomId`, `Description`); [`guestCharacter/index.ts`](../../../../lambda/ephemera/guestCharacter/index.ts) (`Name`, `Pronouns`, `Color`, `assets`, `RoomStack`, `player`); positions' [`ludicGraph/index.ts`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) (`ludicGraph`, which stays with positions, like object placement).

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **CH-1** | **Asset-loss relocation trigger.** [`repairCharacterLegalPlacement`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/repairCharacterLegalPlacement.ts) relocates when the trimmed ladder's top frame differs from current membership. That comparison assumes the ladder is current; once it is maintained by a subscriber, a lagging ladder would trigger a false move back to the previous room. **Recommended:** relocate when the **current room's** asset is no longer accessible (which is what asset loss means), and use the ladder only to choose the destination. The function has no live caller (its asset-visibility ingress is future work), so the change is cheap now. | Slice 2 | Open |
| **CH-2** | **Field scope of this plan.** **Recommended:** characters owns `RoomStack` only. Slice 0's table records an owner (or "unclaimed") for every other field, but moving them waits for something that needs it. | Slice 0 close | Open |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0 --- `Meta::Character` field-ownership inventory.**
  - [ ] Grep every reader and writer of `Meta::Character` across `lambda/` and `packages/` (not just ephemera; known hits include `connections`, `diagnostics`, `assets`, `subscriptions`, `chaos`, `updateEphemera`). Search by key string and by `CharacterMeta` / `CharacterMetaItem` use.
  - [ ] Build a table in this plan: field -> writers -> readers -> proposed owner (`characters`, `positions`, or unclaimed). Model it on the objects four-way split table.
  - [ ] Record findings that are not this plan's work, with a home: notably the legacy `RoomId` field (the positions contract says nothing reads it; `updateEphemera` still writes it, `CharacterMetaItem` still carries it, and `mtw-gateways`' [`getCharacterRoomIdFromDynamo`](../../../../packages/mtw-gateways/ts/ephemera/positions/fetch.ts) still reads it --- exported, with no caller), and `updateEphemera` writing body fields from another lambda.
  - [ ] Settle CH-2.
- [ ] **Slice 1 --- scaffold `mtw.ephemera.characters` and move the ladder.**
  - [ ] New `lambda/ephemera/dataSource/characters/` from the narration template: `index.ts` (`busOnly`, `replayable: false`), `subscribedEvents.ts` (guard for positions' `Character Moved`), `publishedEvents.ts`, `AGENT.md`.
  - [ ] Register in [`app.ts`](../../../../lambda/ephemera/app.ts) and add the row to [`dataSource/AGENT.md`](../../../../lambda/ephemera/dataSource/AGENT.md)'s DataSource table.
  - [ ] Move the ladder modules listed under Grounding facts into `characters/` (subfolder name is a free choice). Update every importer, including `internalCache/characterMeta.ts` and `guestCharacter/index.ts`.
  - [ ] Subscriber: on `Character Moved` with `to !== null`, call `persistRoomStackNavigate` with the fact's `beatAnchorTime`; read character, room and canon assets from cache. Keep the failure-tolerance rule (log, never throw).
  - [ ] Remove the ladder write from `orchestrateCharacterMove`'s `Promise.all` and delete the docblock carve-out that existed only because of it.
  - [ ] Tests: move the ladder unit tests with their modules; add subscriber tests (navigate fact -> write; `to: null` -> no write; persist failure -> logged, no throw); add a duplicate-delivery test (same fact twice -> same stack), which also checks `mergeRoomStack` is idempotent at an equal timestamp.
- [ ] **Slice 2 --- read-side safety and the payoff test.**
  - [ ] Implement CH-1 in `repairCharacterLegalPlacement`, with tests for: current room still accessible -> no move even when the ladder's top differs; current room inaccessible -> move to the trimmed top frame.
  - [ ] Payoff integration test (`*.integration.test.ts`, real bus): navigate into an overlay room -> disconnect -> connect places the character there; remove overlay access -> connect places them at the canon frame.
- [ ] **Slice 3 --- graduate docs and close.**
  - [ ] Positions [contract](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#eviction-ladder-roomstack-storage): keep the read-side rules (trim, top frame, move when the endpoint changes; disconnect purges membership and keeps the ladder; no `Character Moved` for ladder-only change). Move the maintenance rules (navigate merge, trim persist, failure tolerance) to the characters docs. Remove the "navigate ladder timing" rule that names the `Promise.all`.
  - [ ] Move the "Eviction ladder" concept entry to the characters docs; leave positions' graph-roles table pointing to it.
  - [ ] Update [`positions/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) (Eviction ladder section) and [`positions/manipulation/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) (the "RoomStack is not a kernel input" paragraph).
  - [ ] Record the out-of-scope follow-ups where they will be found: character-move convergence onto `commitAndPresentStepSequence` in `positions/manipulation/AGENT.implementation.md`; Slice 0's unclaimed fields and the `RoomId` finding in the characters `AGENT.md`.
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
| 0 --- ownership inventory | Not started |
| 1 --- scaffold and move | Not started |
| 2 --- read-side safety, payoff test | Not started |
| 3 --- docs and close | Not started |
