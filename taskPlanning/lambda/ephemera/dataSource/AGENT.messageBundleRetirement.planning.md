# Message bundle retirement: compiler-stamped transcript order, and character moves on the presentation kernel

**Status:** Slice 3 done. **Next:** Slice 4 (delete the bundle layer, graduate docs, close).

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../AGENT.md). It is an **implementation plan**, not a design-stage one.

## Goal

Retire `mtw.ephemera.messageOrchestration`'s **bundle** layer (declare, settle, ordered flush, `CreatedTime` assignment) and keep its **content-ingress** layer (single-flight render kickoff, replay, per-listener header/full projection, placeholder-then-terminal waves under one `MessageId`). Transcript order comes from times the **compiler** assigns, not from a bundle that holds messages until they all resolve.

**Why this works:** the client already orders by `CreatedTime`, not by arrival. [`charcoal-client/src/slices/messages/index.ts`](../../../../charcoal-client/src/slices/messages/index.ts) inserts by `(CreatedTime, MessageId)` with [`binarySearch.ts`](../../../../charcoal-client/src/slices/messages/binarySearch.ts), and keeps each `MessageId` at its **earliest** `CreatedTime` while showing its **latest** revision. [`AGENT.narrativeTranscript.concepts.md`](../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md) already says the bundle's single batched push is "a convenience of that mechanism, not a client contract ... correctness rests on `CreatedTime`." The bundle's stated reason for owning time assignment (producers would each repeat beat-anchor arithmetic) no longer holds: the compiler is now the one place that knows the full order.

**Second goal, the original motivation:** converge character moves onto [`commitAndPresentStepSequence`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitAndPresentStepSequence.ts). The navigate header becomes an ordinary kernel `describe` step (header format, compiler-ordered), and the post-commit work in [`orchestrateCharacterRoomMembership`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/orchestrateCharacterRoomMembership.ts) is deleted or moved to `Character Moved` subscribers.

**Payoff test (observable output):** a character navigates into a room whose render is **not cached**. The PublishMessages the server emits, fed **in emitted order** into the real client messages slice, produce presentation rows for the mover in the order **header, arrive**, with the header showing the **terminal** render text at the position where its placeholder first appeared. An observer in the departure room gets the **leave** line. No bundle is declared anywhere in the invocation.

**Out of scope:** reactive broadcast perception on `PerceptionThreads` (`roomHeaderBroadcast`, `sessionOrientationAffordances`); turning ingress into a real stream subscription (the "API ingress only" deferral in [`messageOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/messageOrchestration/AGENT.md#explicit-non-goals)); renders that complete in a **later** invocation (unchanged by this plan: ingress state is per-invocation today and stays so); the character body-field findings in [`characters/AGENT.md`](../../../../lambda/ephemera/dataSource/characters/AGENT.md#open-findings).

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md) once for the durability split.
2. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md) for the lambda (Jest; run from `lambda/ephemera` with `npm run test`, not `npm test`) and [`taskPlanning/charcoal-client/AGENT.development.md`](../../../charcoal-client/AGENT.development.md) for the client (Vitest; run from `charcoal-client` with `npm run test:single`). If commands conflict, follow those files.
3. Baselines before edits:
   - From `lambda/ephemera`: `npm run test -- --watchAll=false`. `*.integration.test.ts` files sit outside `tsconfig`, so `tsc` alone misses them; run the full suite after any move or rename, and grep module paths, not just symbols.
   - From `charcoal-client`: `npm run test:single -- src/slices/messages`. Vitest is transpile-only here too; verify type-level claims with a one-off `tsc`.
4. Read, in order:
   - [`messageOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/messageOrchestration/AGENT.md): the two layers this plan splits, and the invariants under "Content ingress / delivery seam" (the roster-broadcast gating invariant must survive unchanged).
   - [`AGENT.narrativeTranscript.concepts.md`](../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md): `CreatedTime` as transcript position.
   - [`positions/AGENT.contract.md` --- Narration and presentation](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#narration-and-presentation) and [`manipulation/AGENT.implementation.md`](../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md): the compiled plan, `presentStepSequence`, and the composer's live callers.
   - The client's ordering code: [`index.ts`](../../../../charcoal-client/src/slices/messages/index.ts) (`mergeMessageIdAggregate`, `applyPresentationIfLatest`) and [`selectors.ts`](../../../../charcoal-client/src/slices/messages/selectors.ts) (room-header/affordance grouping).

### Grounding facts (verified 2026-10-08)

**Bundle producers today** (every `sendMessageBundleDeclared` / `registerIngressSlot` caller):

| Producer | Slots | After this plan |
| --- | --- | --- |
| `presentCharacterMove.ts` (navigate, home, connect, disconnect, repair) | none (Slice 2: header is a `describe` step; leave/arrive publish directly) | Done (Slice 3): the file is deleted; every move goes through `orchestrateCharacterMove` -> `commitAndPresentStepSequence` |
| [`commitAndPresentStepSequence.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitAndPresentStepSequence.ts) (`commitAttempt`, two `actions/index.ts` callers) | the compiled plan's `slots` | Done (Slice 2): presents with the commit's `beatAnchorTime`, no declare |
| [`deliverNarrationUnits.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/deliverNarrationUnits.ts) (command-attempt narration) | one per narration variant | Done (Slice 2): publishes directly, times continue after the plan's last index |
| [`handleLookCommandRequestedForRenderOrchestration.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) (room/feature/knowledge/object look) | 1 | Listener carries its own time (Slice 1) |
| [`handleCharacterRegisteredOrientation.ts`](../../../../lambda/ephemera/dataSource/connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) (session orientation render) | 1 | Same (Slice 1) |
| [`requestFullRoomDescriptionForCharacter.ts`](../../../../lambda/ephemera/dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts) | 1 | Same (Slice 1) |

**The client's revision rule needs strictly increasing times per `MessageId`.** `applyPresentationIfLatest` applies a row only when `message.CreatedTime === agg.latestCreatedTime`, and the row's position is `agg.earliestCreatedTime`. So a placeholder and its terminal must share a `MessageId` and the terminal must carry a **strictly greater** `CreatedTime`. Today `DeliveredSlotIndex` provides this for post-flush terminals (`Math.max(already.createdTime + 1, getCurrentTimestamp())`). After this plan, the ingress listener holds its `MessageId` and last-published time and applies the same rule to every wave.

**Ties sort by `MessageId`, which is a uuid.** Every presentation step in one plan needs a **distinct** time. `beatAnchorTime + ordinal` (1 ms apart) matches today's `baseTime + offset`, so cross-invocation collision risk is unchanged.

**The anchor moves earlier, and no reordering hazard was found.** The bundle stamps at **flush** (`getCurrentTimestamp()` in `MessageOrchestrationFanInCluster.handler`). The compiler path stamps at **commit** (`beatAnchorTime` from [`commitStepSequence.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts)). Only messages published between commit and (old) flush can change relative order. Slice 0 read every `PublishMessage` site in the four invocations (table below); the only ones that land in that window are the mover's **affordance headers** (`publishAffordancePerceptionForPerspective`, implicit time) and the reactive `roomHeaderBroadcast` placeholder/terminal for other occupants (explicit `getCurrentTimestamp()`). Both used to sort **before** the bundle's lines and now sort **after** them. The client is insensitive to that: the affordance branch in [`selectors.ts`](../../../../charcoal-client/src/slices/messages/selectors.ts) (`getMessagesByRoom`) merges an affordance header into the current room group, or parks it in `pendingAffordanceByRoom` until the render header arrives, without consuming a transcript position. Everything else is published before commit (command echo, parse responses) and is unaffected. This is a code-reading verdict; Slice 2's payoff test checks it by feeding a trailing affordance header into the real slice.

| Publish site | Time source | In the commit-to-flush window? |
| --- | --- | --- |
| [`actions/index.ts`](../../../../lambda/ephemera/dataSource/actions/index.ts): command echo (`CommandTranscriptMessage`), parse errors and OOC replies, Acme/Coyote replies | implicit (`publishMessage` `baseTime + index`, at publish) | No: published before the attempt reaches commit |
| [`perception/index.ts`](../../../../lambda/ephemera/perception/index.ts) `Perception` header publish | implicit | No bundle involvement; navigate's fallback only |
| `perception/index.ts` `sendRoomGeneratingHeader` | explicit `getCurrentTimestamp()` | Reactive broadcast, other occupants; stays on `PerceptionThreads` |
| [`perception/orchestrate.ts`](../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) `roomHeaderBroadcast` placeholder (`t0`) and terminal (`max(t0 + 1, now)`) | explicit | Yes, other occupants; client-insensitive (above) |
| `perception/orchestrate.ts` fallback roster broadcast (no listener) | implicit | Only when no ingress listener registered |
| [`publishAffordancePerceptionForCharacters.ts`](../../../../lambda/ephemera/dataSource/perception/publishAffordancePerceptionForCharacters.ts) | implicit | Yes, the mover; client-insensitive (above) |
| [`narration/handleCharacterSpoke.ts`](../../../../lambda/ephemera/dataSource/narration/handleCharacterSpoke.ts), Coyote handlers | implicit / explicit `t0`, `t1` | Not part of a move or look invocation |

**The bus dispatches every `PublishMessage` on its own.** [`InternalMessageBus.publish`](../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) calls each subscriber immediately with `payloads: [payload]`, so there is no batching: each bundle slot is its own `publishMessage` call (its own persisted row and wire push) at its explicit `createdTime`. [`AGENT.narrativeTranscript.concepts.md`](../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md) says a flush "delivers a bundle's slots as one wire push"; that is wrong, and Slice 4 corrects it. MB-1's deduplication is therefore still needed: a placeholder and its terminal published separately are two stored rows.

**A one-slot bundle flushes on its first report.** `FanInClusterStore.completeReadyPartials` runs after every `route()` and flushes any cluster whose declared slots are all reported, so a one-slot bundle published the placeholder immediately and the terminal as a post-flush revision; only multi-slot bundles (navigate) ever held a wave. Found in Slice 1 (see MB-1).

**`roomRosterSnapshots` has no production reader.** It is built in `orchestrateCharacterRoomMembership` and returned on `MembershipApplyResult`; only tests read it.

**The ladder write used to leave a partial `CharacterMeta` cache entry (fixed in Slice 3).** `persistRoomStackNavigate`'s `successCallback` cached `{ ...prior, EphemeraId, RoomStack }`, but `optimisticUpdate` fetches `prior` with `ProjectionFields` of only `updateKeys` plus the key fields ([`update.ts`](../../../../packages/mtw-utilities/ts/dynamoDB/mixins/update.ts)), so the cached entry lacked `Name`, `assets`, `Color`, `HomeId`, `Pronouns` and `player` for the rest of the invocation. Whether it had a live victim was a race with positions' post-commit invalidate. The success path now invalidates instead (rule recorded in [`characters/AGENT.md`](../../../../lambda/ephemera/dataSource/characters/AGENT.md#ladder-maintenance)), and the test in `persistRoomStackNavigate.test.ts` pins it.

**Between commit and the ladder write, the cache is not stale (MB-4's safety condition holds).** `commitStepSequence` writes `Meta::Character` only with `updateKeys: ['ludicGraph']` ([`commitStepSequence.ts:122-154`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts)), a field `CharacterMeta` does not project (it projects `Name`, `RoomStack`, `Color`, `fileURL`, `HomeId`, `assets`, `Pronouns`, `player`). The only projected field a move changes is `RoomStack`, and that is unchanged in storage until the subscriber writes it. Positions' post-commit `CharacterMeta.invalidate` therefore re-reads identical data.

**One attempt declares one `bundleId` twice; it is harmless today and a latent slot-loss hazard.** `commitAttempt` passes its `bundleId` to `commitAndPresentStepSequence` (which declares `plan.slots`) and then to `deliverNarrationUnits` (which declares its own slots). A throwaway test against the real `FanInClusterStore` showed: when the first declare's slots are all reported before the second declare (the live case), all four messages publish in order. When the first declare is only partly reported, the second declare cannot seed its own cluster (`canAcceptLeg` refuses a second declare, and unification keeps the first cluster's `declaredSlots`), so the second declare's slots are **silently dropped** and their reports are never published. `DeliveredSlotIndex.record` merges per bundle and is not a problem. The live case holds because the compiler declares a slot only alongside the narrate step that reports it (the unreported header slot exists only on navigate, which is not a `commitAttempt` route). No fix is needed; the hazard disappears with the bundle in Slice 4. The throwaway test was deleted.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). MB-1 is the only row still here, and it stays until Slice 4 records it; MB-2, MB-3 and MB-4 shipped (Slices 2 and 3) and live in `positions/AGENT.contract.md` and `characters/AGENT.md`. Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| MB-1 | **Placeholder handling.** The original premise was that a placeholder and its terminal both resolving before the bundle flushes sends only the terminal (`registerLeg`'s map overwrite). **Slice 1 found that premise false for one-slot listeners:** `FanInClusterStore.completeReadyPartials` flushes a complete cluster on its first report, so a one-slot bundle always published the placeholder immediately and the terminal as a post-flush revision. Holding each listener's latest wave until settle would have hidden the "Generating…" placeholder for every render that finishes in the same invocation (the settle loop waits for generation), and broke `characterRegisteredOrientation.integration.test.ts`. **Decided (revised): a direct listener publishes every wave as it arrives** (first at its pre-assigned time, later ones at `max(lastPublished + 1, now)`, same `MessageId`); a late registrant is replayed only the latest recorded event. No per-listener buffer and no settle flush. Deduplication that remains is replay collapse. Listeners never wait on each other. | 1 | Decided (revised in Slice 1) |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark each nested line `[X]` as it is done.

- [X] **Slice 0 --- grounding checks (no code).** Results recorded in [Grounding facts](#grounding-facts-verified-2026-10-08).
  - [X] Inventoried every `PublishMessage` site in the navigate, look, command-attempt and connect invocations (table in Grounding facts). No reordering hazard: the only messages in the commit-to-flush window are affordance headers and reactive header broadcasts, and the client's grouping does not give them a transcript position. Also found that the bus never batches: each bundle slot is its own publish.
  - [X] Confirmed the double-declare behavior with a throwaway test (deleted): harmless when the first declare's slots are all reported, which is the live case; a latent slot-loss hazard otherwise. No fix needed; it disappears with the bundle.
  - [X] Confirmed MB-4's safety condition: a move writes only `ludicGraph` on `Meta::Character`, and `RoomStack` is the only projected `CharacterMeta` field it changes. Confirmed the partial-cache-entry mechanism in `update.ts`; whether it has a live victim is a race, so Slice 3 pins it with a test.
  - [X] Grepped doc references to bundles. The known-homes list was complete, plus one historical log row that stays (see Slice 4).
- [X] **Slice 1 --- ingress listeners carry their own time and `MessageId`.**
  - [X] `registerIngressSlot` takes a delivery address of either `{ bundleId }` (existing, removed in Slice 4) or `{ createdTime, messageId }` (`newDirectIngressAddress()`). With the second, a listener publishes directly: first wave at `createdTime`, each later wave at `max(lastPublished + 1, getCurrentTimestamp())`, always under the listener's `MessageId`.
  - [X] Converted the three one-slot producers (look family, session orientation render, `requestFullRoomDescriptionForCharacter`) to the direct address. Their bundle declares are gone.
  - [X] MB-1 revised (see the row): the buffer-until-settle design was built, then removed when the full suite showed it hides placeholders; direct listeners publish every wave as it arrives.
  - [X] Tests: direct listeners publish placeholder then terminal under one `MessageId` with strictly increasing times, including a terminal after settle; a late registrant gets only the latest replay at its own time; mixed bundle and direct listeners on one bucket; the roster-broadcast gating is unchanged (`reportIngressContent` still returns the listener count; the existing perception tests pass). Full ephemera suite green.
- [X] **Slice 2 --- compiler-stamped presentation order.** Shipped; rules recorded in `positions/AGENT.contract.md` (Narration and presentation) and `positions/manipulation/AGENT.implementation.md`.
  - [X] Apply MB-2: the compiled plan is `{ steps }` (no `slots`); its `narrate`/`describe` steps in array order are the presentation list, stamped `beatAnchorTime + index`, each with its own `MessageId`.
  - [X] `presentStepSequence`'s narrate branch publishes `PublishMessage` directly with its stamped time instead of `sendMessageSlotReported`.
  - [X] Apply MB-3 (header binding is `{ perspectiveKey: string | null, assets }`; **a `null` key publishes the static cache header at the stamped place instead of dropping it**, since the old `Perception` fallback was not a no-op there); the compiler emits the navigate header as a `describe` step in its ordered position; `presentCharacterMove`'s `registerIngressSlot` tail and its `Perception` fallback are removed.
  - [X] `commitAndPresentStepSequence` stops declaring bundles. `deliverNarrationUnits` publishes each variant directly, with times continuing after the plan's last presentation index (pass the next index from the composer's result).
  - [X] `NAVIGATE_HEADER_SLOT_ID`, `moveBundleSlotIds.ts` and slot-id plumbing on narrate steps are deleted or reduced to what the ordered list needs.
  - [X] **Payoff test** (`navigateStampedOrder.integration.test.ts` and `charcoal-client/.../messages/navigateStampedOrder.test.ts`; the server half drives the real compiler, presenter and ingress with a stubbed passive-render kickoff rather than a full `orchestrateCharacterMove`): an ephemera integration test captures the published rows for a navigate into an uncached room and asserts their `(CreatedTime, MessageId)` order, targets and `MessageId` sharing; a `charcoal-client` Vitest ingests that same row sequence, in emitted order, through the real messages slice and asserts the mover's and observer's presentation rows. No cross-package harness exists, so the client test uses a real-shape fixture of the server's rows fed into the real slice, not a mocked consumer. The fixture includes an affordance header with a time **after** the arrive line, since that is the one message Slice 0 found that changes position relative to the bundle's lines.
- [X] **Slice 3 --- converge character moves onto `commitAndPresentStepSequence`.** Shipped; rules recorded in `positions/AGENT.contract.md` (Membership persistence API), `positions/AGENT.implementation.md`, `positions/manipulation/AGENT.implementation.md` and `characters/AGENT.md` (Ladder maintenance).
  - [X] Delete `roomRosterSnapshots` (production code, `MembershipApplyResult`, tests). `MembershipApplyResult` is now `{ ok, froms, to, changed }` or the error arm; `MembershipApplyArgs` was deleted with the coordinator.
  - [X] Apply MB-4: `persistRoomStackNavigate` invalidates `CharacterMeta` after a successful write instead of `set`ting a partial entry; positions' post-commit invalidate is deleted; the `CharacterInPlay` publish moved to `publishCharacterInPlay`, a second `Character Moved` handler in `mtw.ephemera.characters`.
  - [X] Test: `persistRoomStackNavigate.test.ts` asserts the success path invalidates and never `set`s (failed before the change), and a failed write touches nothing. It pins the mechanism rather than a same-invocation `get`, because `optimisticUpdate` is mocked there.
  - [X] `orchestrateCharacterMove` is now: no-op pre-check, `planCharacterMoveTransfer`, `commitAndPresentStepSequence`. `orchestrateCharacterRoomMembership` and `presentCharacterMove` (and their tests) are deleted. The no-op pre-check still costs only the containers read.
  - [X] All six call sites still pass their existing tests; the Slice 2 payoff test (`navigateStampedOrder.integration.test.ts`) now drives `presentStepSequence` directly. `characterLadderConnectPayoff.integration.test.ts` stubs `publishCharacterInPlay`, since it observes the ladder write only.
- [ ] **Slice 4 --- delete the bundle layer, graduate docs, close.**
  - [ ] Delete `messageOrchestrationFanIn.ts`, `deliveredSlotIndex.ts`, the `Message Bundle Declared` / `Message Slot Reported` commands and their send helpers, and the `{ bundleId }` delivery address from Slice 1. Reduce the `fanIn-mtw.ephemera.messageOrchestration` deferral in `messageOrchestration/index.ts` to `onClear` (its `afterSettled` only settles the bundle fan-in; MB-1 no longer needs a settle flush). Decide whether what remains (content ingress) keeps its DataSource or becomes a plain module; record the choice in its doc.
  - [ ] Rewrite `messageOrchestration/AGENT.md` as the content-ingress doc. State the time and `MessageId` rules (strictly increasing per `MessageId`, distinct times per plan) as contract rules.
  - [ ] Update every doc that mentions bundles (found by Slice 0's grep: `rg -n "messageOrchestration|Message Bundle|bundleId|sendMessageBundleDeclared|sendMessageSlotReported|Message Slot Reported|bundle flush|slot-report|MessageOrchestrationFanIn|DeliveredSlotIndex" --glob '*.md' lambda packages charcoal-client taskPlanning`): `lambda/ephemera/AGENT.narrativeTranscript.concepts.md`, `dataSource/messageOrchestration/AGENT.md`, `dataSource/actions/AGENT.implementation.md`, `dataSource/positions/AGENT.contract.md`, `dataSource/positions/AGENT.implementation.md`, `dataSource/positions/manipulation/AGENT.implementation.md`, `dataSource/renderOrchestration/AGENT.md`, `dataSource/perception/AGENT.md`, `internalCache/AGENT.md`, `publishMessage/README.md`, `packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`. Leave the 2026-10-07 row in `taskPlanning/AGENT.designVariant.performance.md`: it is a dated log entry, not a description of the system. `AGENT.narrativeTranscript.concepts.md` gets vocabulary only: transcript position is assigned at compile time from the beat anchor; its claim that a bundle flush delivers "one wire push" is also corrected (the bus never batches).
  - [ ] Update the ~30 test files that reference bundles (`rg -l "bundleId|sendMessageBundleDeclared|sendMessageSlotReported|NAVIGATE_HEADER_SLOT_ID|DeliveredSlotIndex" --glob '*.test.ts' lambda`); most are in `messageOrchestration/`, `positions/manipulation/` and `perception/`. The full suite catches the rest, but `*.integration.test.ts` files sit outside `tsconfig`, so grep module paths.
  - [ ] Record shipped MB rows in `positions/AGENT.contract.md` / `AGENT.implementation.md` and remove them here.
  - [ ] Sweep inbound links to every deleted file and moved anchor, and to this plan's path, then delete this plan.

## Progress

| Slice | Status |
| --- | --- |
| 0 --- grounding checks | Done |
| 1 --- ingress listeners own time | Done |
| 2 --- compiler-stamped order | Done |
| 3 --- character-move convergence | Done |
| 4 --- delete bundles and close | Not started |

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false
```

From `charcoal-client` (Slice 2 onward):

```bash
npm run test:single -- src/slices/messages
```

Bundle-retirement greps (Slice 2 should empty the first for `positions/`; Slice 4 should empty all of them outside this plan):

```bash
rg -n "sendMessageBundleDeclared|sendMessageSlotReported" lambda/ packages/
rg -n "DeliveredSlotIndex|MessageOrchestrationFanIn" lambda/ packages/
rg -n "NAVIGATE_HEADER_SLOT_ID|roomRosterSnapshots|orchestrateCharacterRoomMembership|presentCharacterMove" lambda/
rg -n "AGENT.messageBundleRetirement.planning.md" lambda/ packages/ charcoal-client/ taskPlanning/
```
