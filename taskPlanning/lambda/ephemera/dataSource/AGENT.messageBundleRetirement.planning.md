# Message bundle retirement: compiler-stamped transcript order, and character moves on the presentation kernel

**Status:** Draft, not started. **Next:** Slice 0 (grounding checks).

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
| [`presentCharacterMove.ts`](../../../../lambda/ephemera/dataSource/positions/navigate/presentCharacterMove.ts) (navigate, home, connect, disconnect, repair) | leave(s), header, arrive | Header becomes a `describe` step; whole route goes through the composer (Slices 2, 3) |
| [`commitAndPresentStepSequence.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitAndPresentStepSequence.ts) (`commitAttempt`, two `actions/index.ts` callers) | the compiled plan's `slots` | Stamps presentation times instead of declaring (Slice 2) |
| [`deliverNarrationUnits.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/deliverNarrationUnits.ts) (command-attempt narration) | one per narration variant | Publishes directly with stamped times (Slice 2) |
| [`handleLookCommandRequestedForRenderOrchestration.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) (room/feature/knowledge/object look) | 1 | Listener carries its own time (Slice 1) |
| [`handleCharacterRegisteredOrientation.ts`](../../../../lambda/ephemera/dataSource/connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) (session orientation render) | 1 | Same (Slice 1) |
| [`requestFullRoomDescriptionForCharacter.ts`](../../../../lambda/ephemera/dataSource/actions/actionHandlers/requestFullRoomDescriptionForCharacter.ts) | 1 | Same (Slice 1) |

**The client's revision rule needs strictly increasing times per `MessageId`.** `applyPresentationIfLatest` applies a row only when `message.CreatedTime === agg.latestCreatedTime`, and the row's position is `agg.earliestCreatedTime`. So a placeholder and its terminal must share a `MessageId` and the terminal must carry a **strictly greater** `CreatedTime`. Today `DeliveredSlotIndex` provides this for post-flush terminals (`Math.max(already.createdTime + 1, getCurrentTimestamp())`). After this plan, the ingress listener holds its `MessageId` and last-published time and applies the same rule to every wave.

**Ties sort by `MessageId`, which is a uuid.** Every presentation step in one plan needs a **distinct** time. `beatAnchorTime + ordinal` (1 ms apart) matches today's `baseTime + offset`, so cross-invocation collision risk is unchanged.

**The anchor moves earlier.** The bundle stamps at **flush** (`getCurrentTimestamp()` in `MessageOrchestrationFanInCluster.handler`). The compiler path stamps at **commit** (`beatAnchorTime` from [`commitStepSequence.ts`](../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts)). Any message published in the same invocation between commit and flush, with its own `getCurrentTimestamp()`, could change relative order. Slice 0 inventories these.

**`roomRosterSnapshots` has no production reader.** It is built in `orchestrateCharacterRoomMembership` and returned on `MembershipApplyResult`; only tests read it.

**The ladder write leaves a partial `CharacterMeta` cache entry.** `persistRoomStackNavigate`'s `successCallback` caches `{ ...prior, EphemeraId, RoomStack }`, but `optimisticUpdate` fetches `prior` with `ProjectionFields` of only `updateKeys` plus the key fields ([`update.ts`](../../../../packages/mtw-utilities/ts/dynamoDB/mixins/update.ts)). The cached entry therefore lacks `Name`, `assets`, `Color`, `HomeId`, `Pronouns` and `player` for the rest of the invocation. This predates the characters DataSource. `trimPersistCharacterRoomStack` is not affected: it spreads a full `CharacterMeta` read first. Fixed by MB-4.

**Between commit and the ladder write, the cache is not stale.** The commit writes only `ludicGraph` on `Meta::Character`, which `CharacterMeta` does not project; the only projected field a move changes is `RoomStack`, and that is unchanged in storage until the subscriber writes it. Positions' post-commit `CharacterMeta.invalidate` therefore re-reads identical data.

**One attempt can declare one `bundleId` twice.** `commitAttempt` passes its `bundleId` to `commitAndPresentStepSequence` (which declares `plan.slots`) and then to `deliverNarrationUnits` (which declares its own slots). `MessageOrchestrationFanInCluster.registerLeg` **replaces** `declaredSlots` on a second declare. Whether that loses slots depends on whether the first cluster already completed. Slice 0 confirms; the hazard disappears with the bundle either way.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| MB-1 | **Placeholder suppression.** Today, if a placeholder and its terminal both resolve before the bundle flushes, only the terminal is sent (`registerLeg`'s map overwrite). **Decided: deduplicate per listener in content ingress.** Each listener keeps only its latest pending wave, and publishes it once at settle (the existing `afterSettled` deferral in `messageOrchestration/index.ts`) at its pre-assigned time and `MessageId`. A wave arriving after its listener has published goes out immediately at `max(lastPublished + 1, now)`. Listeners never wait on each other, so this keeps no bundle state and does not affect compiler-stamped order. | 1 | Decided |
| MB-2 | **Where presentation order lives.** **Decided: an ordered list on the compiled plan** (today's `plan.slots`, renamed and stripped of bundle fields). Presentation stamps entry `i` at `beatAnchorTime + i`, 1 ms apart. | 2 | Decided |
| MB-3 | **Header as a `describe` step.** **Decided:** `describe` gains an optional header binding (the slot spec's `format: 'header'`, perspective key, targets), delivered by registering an ingress listener and kicking the passive render, as `presentCharacterMove` does today. Full-format `describe` keeps the `Look Command Requested` path, forwarding its stamped time. This answers the "a `describe` step cannot request a header slot" open question in [`messageOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/messageOrchestration/AGENT.md#registered-render-kinds). | 2 | Decided |
| MB-4 | **Home for the move's post-commit work.** **Decided: `Character Moved` subscribers in `mtw.ephemera.characters`.** The cache invalidate runs in the ladder subscriber **after** the ladder write, replacing both positions' post-commit `CharacterMeta.invalidate` and `persistRoomStackNavigate`'s partial `CharacterMeta.set` (see [Grounding facts](#grounding-facts-verified-2026-10-08)). The `CharacterInPlay` publish moves to a characters subscriber too. Safety condition (Slice 0 confirms): no cached field other than `RoomStack` changes on a move, so between commit and the ladder write the cache matches the stored row. | 3 | Decided |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark each nested line `[X]` as it is done.

- [ ] **Slice 0 --- grounding checks (no code).** Record results in [Grounding facts](#grounding-facts-verified-2026-10-08).
  - [ ] Inventory every message published in a navigate, look, command-attempt and connect invocation **without** going through a bundle (affordance pushes, `EphemeraUpdate`, command echo, Coyote narration, roster updates). For each, note its `CreatedTime` source and whether moving bundle times from flush to `beatAnchorTime` reorders it in the client. Pay attention to the room-header/affordance grouping in `selectors.ts`.
  - [ ] Confirm the double-declare behavior in `commitAttempt` + `deliverNarrationUnits` (one test is enough). If it already drops slots, note it as a live bug that Slice 2 fixes.
  - [ ] Confirm MB-4's safety condition: list every `Meta::Character` write in a move's commit and confirm `RoomStack` is the only projected field a move changes. List every `CharacterMeta.get` that can run in a move's invocation after the ladder write, to confirm whether the partial-entry bug has a live victim today (`Name`, `assets`).
  - [ ] Grep doc references to bundles (`messageOrchestration`, `Message Bundle`, `bundleId`) across `lambda/`, `packages/`, `charcoal-client/`, `taskPlanning/`. Known homes: `narrativeTranscript.concepts.md`, `messageOrchestration/AGENT.md`, `actions/AGENT.implementation.md`, `positions/AGENT.contract.md`, `positions/AGENT.implementation.md`, `positions/manipulation/AGENT.implementation.md`, `renderOrchestration/AGENT.md`, `perception/AGENT.md`, `internalCache/AGENT.md`, `publishMessage/README.md`, `packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`. Slice 4 rewrites them.
- [ ] **Slice 1 --- ingress listeners carry their own time and `MessageId`.**
  - [ ] `registerIngressSlot` takes a delivery address of either `{ bundleId }` (existing, removed in Slice 4) or `{ createdTime, messageId }`. With the second, `deliverListenerContent` publishes directly: first wave at `createdTime`, each later wave at `max(lastPublished + 1, getCurrentTimestamp())`, always under the listener's `MessageId`.
  - [ ] Convert the three one-slot producers (look family, session orientation render, `requestFullRoomDescriptionForCharacter`) to the direct address, anchored at `getCurrentTimestamp()` at registration. Drop their bundle declares.
  - [ ] Apply MB-1: per-listener latest-wave buffer, flushed at settle.
  - [ ] Tests: placeholder then terminal before settle yields **one** publish (the terminal); a terminal after settle yields a second publish with the same `MessageId` and a strictly greater time; a late registrant gets replay at its own time; the roster-broadcast fallback gating (`entries.length === 0 && publishedCharacterMove === 0`) is unchanged.
- [ ] **Slice 2 --- compiler-stamped presentation order.**
  - [ ] Apply MB-2: the compiled plan carries an ordered presentation list with no bundle fields; presentation stamps `beatAnchorTime + index` and mints each step's `MessageId`.
  - [ ] `presentStepSequence`'s narrate branch publishes `PublishMessage` directly with its stamped time instead of `sendMessageSlotReported`.
  - [ ] Apply MB-3: `describe` gains the header binding; the compiler emits the navigate header as a `describe` step in its ordered position; `presentCharacterMove`'s `registerIngressSlot` tail and its `Perception` fallback are removed.
  - [ ] `commitAndPresentStepSequence` stops declaring bundles. `deliverNarrationUnits` publishes each variant directly, with times continuing after the plan's last presentation index (pass the next index from the composer's result).
  - [ ] `NAVIGATE_HEADER_SLOT_ID`, `moveBundleSlotIds.ts` and slot-id plumbing on narrate steps are deleted or reduced to what the ordered list needs.
  - [ ] **Payoff test** (see [Goal](#goal)): an ephemera integration test captures the published rows for a navigate into an uncached room and asserts their `(CreatedTime, MessageId)` order, targets and `MessageId` sharing; a `charcoal-client` Vitest ingests that same row sequence, in emitted order, through the real messages slice and asserts the mover's and observer's presentation rows. No cross-package harness exists, so the client test uses a real-shape fixture of the server's rows fed into the real slice, not a mocked consumer.
- [ ] **Slice 3 --- converge character moves onto `commitAndPresentStepSequence`.**
  - [ ] Delete `roomRosterSnapshots` (production code, `MembershipApplyResult`, tests).
  - [ ] Apply MB-4: `persistRoomStackNavigate` invalidates `CharacterMeta` after a successful write instead of `set`ting a partial entry; delete positions' post-commit invalidate; move the `CharacterInPlay` publish to a characters subscriber.
  - [ ] Test: after a navigate's ladder write, `CharacterMeta.get` in the same invocation returns `Name` and `assets` (fails today).
  - [ ] `orchestrateCharacterMove` becomes: build the plan (`planCharacterMoveTransfer`), call `commitAndPresentStepSequence`. Fold or delete `orchestrateCharacterRoomMembership` and `presentCharacterMove` once empty. Keep the no-op pre-check (unchanged membership costs only the containers read).
  - [ ] All six call sites (navigate, home, connect, disconnect, ghost-purge repair, legal-placement repair) still pass their existing tests; the payoff integration test still passes.
- [ ] **Slice 4 --- delete the bundle layer, graduate docs, close.**
  - [ ] Delete `messageOrchestrationFanIn.ts`, `deliveredSlotIndex.ts`, the `Message Bundle Declared` / `Message Slot Reported` commands and their send helpers, and the `{ bundleId }` delivery address from Slice 1. Keep the `afterSettled` deferral in `messageOrchestration/index.ts`, reduced to the MB-1 listener flush. Decide whether what remains (content ingress) keeps its DataSource or becomes a plain module; record the choice in its doc.
  - [ ] Rewrite `messageOrchestration/AGENT.md` as the content-ingress doc. State the time and `MessageId` rules (strictly increasing per `MessageId`, distinct times per plan) as contract rules.
  - [ ] Update every doc found in Slice 0's grep. `AGENT.narrativeTranscript.concepts.md` gets vocabulary only: transcript position is assigned at compile time from the beat anchor.
  - [ ] Record shipped MB rows in `positions/AGENT.contract.md` / `AGENT.implementation.md` and remove them here.
  - [ ] Sweep inbound links to every deleted file and moved anchor, and to this plan's path, then delete this plan.

## Progress

| Slice | Status |
| --- | --- |
| 0 --- grounding checks | Not started |
| 1 --- ingress listeners own time | Not started |
| 2 --- compiler-stamped order | Not started |
| 3 --- character-move convergence | Not started |
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
rg -n "NAVIGATE_HEADER_SLOT_ID|roomRosterSnapshots" lambda/
rg -n "AGENT.messageBundleRetirement.planning.md" lambda/ packages/ charcoal-client/ taskPlanning/
```
