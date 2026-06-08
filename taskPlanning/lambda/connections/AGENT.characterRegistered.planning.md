# Character Registered vs Character Connected (`connections` presence split)

**Status:** In progress. Next step: Phase 3a --- extend **`PerceptionThreads`** and terminal fan-in so session orientation uses **thread registration** for both **`Render Pertains`** and **`Affordances Pertain`** (no delivery plumbing through orchestration/cache).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../AGENT.md). This file is task-scoped; archive or delete after the initiative ships and durable docs are updated.

## Problem

Two distinct product needs were collapsed into one pipeline:

| Need | Audience | Steady-state intent |
| --- | --- | --- |
| **Character aggregate connect** (`0 -> 1` sessions on the character) | **The room** (and other occupants) | Project the character into `Meta::Room.activeCharacters`, optional arrival narrative, refresh **affordance** slices for roster/perspective groups already in the room |
| **Session registers a character** (every `registercharacter`) | **This session's client** | Deliver **render + affordance** RoomHeader material so the logging-in player sees where their character is (`SESSION#`-scoped delivery) |

Today:

- **`Character Registered`** (`mtw.connections`) is emitted on every successful `registercharacter` but **ephemera does not subscribe** to it on EventBridge (only the connections lambda derives presence in-process).
- **`Character Connected`** (`mtw.connections.characters`) is the sole ephemera ingress for registration side effects, routed to **`mtw.ephemera.positions`** (world projection via `CheckLocation` / `moveCharacter`).
- The derived **`Character Connected` gate is broken**: [`charactersDataSource.ts`](../../../lambda/connections/dataSource/charactersDataSource.ts) checks `Meta::Character.sessions.length === 0` **after** [`registerCharacterMessage`](../../../lambda/connections/registerCharacter/index.ts) has already added the session, so **`Character Connected` never emits** in production.
- Docs and handlers **conflate** session orientation with aggregate connect (for example [`lambda/ephemera/AGENT.md`](../../../lambda/ephemera/AGENT.md) describes `Character Connected` as driving headers via `moveCharacter`).

These outcomes must be **separate producer events** from `connections`, consumable **independently** (any order, duplicate-tolerant), with **distinct ephemera owners**.

## Wire contracts (existing vs new work)

| Event | Source | Stream key | When emitted | Primary ephemera consumer (target) |
| --- | --- | --- | --- | --- |
| **`Character Registered`** | `mtw.connections` | `CHARACTER#${characterId}` | Every successful `registercharacter` (already implemented) | **`renderOrchestration`** + **`affordanceOrchestration`** (orchestration kick); **`mtw.ephemera.perception`** (dual thread register + **`Render Pertains`** / **`Affordances Pertain`** terminal fan-in) for **session orientation** |
| **`Character Connected`** | `mtw.connections.characters` | `CHARACTER#${characterId}` | Character aggregate session boundary `0 -> 1` only | **`mtw.ephemera.positions`** (world projection; existing) |
| **`Character Disconnected`** | `mtw.connections.characters` | `CHARACTER#${characterId}` | Aggregate boundary `1 -> 0` (existing; verify parity when fixing connect gate) | **`mtw.ephemera.positions`** (existing) |

**Note:** The **`Character Registered` wire type already exists** in [`packages/mtw-interfaces/ts/eventBridge/connections`](../../../packages/mtw-interfaces/ts/eventBridge/connections/index.ts). This initiative **does not** rename it; it **wires cross-lambda consumption** and **detangles documentation** from `Character Connected`.

### Producer invariants (`connections` lambda)

- **`Character Registered`**: always emitted after adjacency + `Meta::Character.sessions` mutation; payload includes `{ characterId, sessionId, timestamp }` (existing).
- **`Character Connected`**: emitted only on aggregate **`0 -> 1`** session boundary; must **not** re-read post-mutation Dynamo state with a `sessions.length === 0` check.
- **Recommended gate fix:** in [`registerCharacter/index.ts`](../../../lambda/connections/registerCharacter/index.ts), read `Meta::Character.sessions` **before** `transactWrite`, then pass a boolean (for example `isFirstSessionForCharacter`) into the derived lane **or** emit `Character Connected` directly from a small helper when the pre-mutation count was `0`. Keep **`Character Registered`** emission unconditional.
- **Ordering:** In-process, both events may originate in one `connections` invocation; cross-lambda consumers must **not** assume `Character Connected` always precedes `Character Registered` or vice versa (EventBridge at-least-once, retries, future splits).

### Consumer invariants (ephemera)

- **`mtw.ephemera.positions`** (`Character Connected` / `Character Disconnected`): **world-facing only** --- `CheckLocation` / `moveCharacter`, roster projection, room-side affordance refresh via existing `RoomUpdate` path. **Do not** treat this as the session RoomHeader bootstrap.
- **Session orientation (new):** on **`Character Registered`**, resolve the character's current room from ephemera `Meta::Character`, compute perspective, then **register two perception threads** (render + affordance channels) with **`targets: [\`SESSION#${sessionId}\`]`** and **`characterId`** for viewer-specific affordance WML. Kick **render** and **affordance** orchestration with **room + perspective only** --- no delivery fields on orchestration/cache streams. Terminal **`PublishMessage`** correlates via **`(componentId, perspectiveKey)`** bucket lookup on **`Render Pertains`** ([`orchestrate.ts`](../../../lambda/ephemera/dataSource/perception/orchestrate.ts)) and **`Affordances Pertain`** ([`handleAffordancesPertain.ts`](../../../lambda/ephemera/dataSource/perception/handleAffordancesPertain.ts)). See Phase 3.
- **Idempotency:** Both consumers tolerate duplicate events; session orientation may re-send headers to the same session; positions uses existing projection gates.

## Scope

### In scope

- Fix **`Character Connected`** producer gate and tests that currently mock impossible post-mutation state.
- Add **EventBridge** subscription: `mtw.connections` / **`Character Registered`** -> **`EphemeraFunction`** ([`template.yaml`](../../../template.yaml); mirror [`ConnectionsCharacters`](../../../template.yaml) pattern).
- Ephemera **`eventDeserializers`** + subscribed-event guards for `mtw.connections` / `Character Registered`.
- Handlers in **`renderOrchestration`** and **`affordanceOrchestration`** (and **`perception`** terminal publish as needed) for session-scoped RoomHeader orientation.
- Documentation detangle (connections + ephemera + dataSources + `mtw-interfaces` EventBridge guide).
- Targeted unit tests and one integration-style test proving **`Character Registered`** can deliver perception rows to **`SESSION#...`** without requiring **`Character Connected`**.

### Out of scope (defer unless blocking)

- Client changes beyond verifying existing RoomHeader composition consumes session-targeted messages (likely already works via message delta targets).
- Replacing **`fetchEphemera`** stub in [`lambda/ephemera/fetchEphemera/index.ts`](../../../lambda/ephemera/fetchEphemera/index.ts) (separate initiative; session orientation should not depend on it).
- **`Character Disconnected`** session-scoped "unregister orientation" (optional follow-on).
- Replay / external contract for `mtw.connections` (not required for v1).

## Getting started

1. Task-planning conventions: [`taskPlanning/AGENT.md`](../../AGENT.md)
2. Connections steady state: [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md)
3. Producer implementation: [`lambda/connections/registerCharacter/index.ts`](../../../lambda/connections/registerCharacter/index.ts), [`lambda/connections/dataSource/charactersDataSource.ts`](../../../lambda/connections/dataSource/charactersDataSource.ts)
4. Positions consumer (world path): [`lambda/ephemera/dataSource/positions/`](../../../lambda/ephemera/dataSource/positions/), [`handleConnectionsCharactersPresence.ts`](../../../lambda/ephemera/dataSource/positions/handleConnectionsCharactersPresence.ts)
5. Orchestration + perception (orientation path): [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md), [`lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md), [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../lambda/ephemera/dataSource/perception/AGENT.md)
6. Multi-channel RoomHeader contract: [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md)
7. EventBridge contracts: [`packages/mtw-interfaces/ts/eventBridge/connections`](../../../packages/mtw-interfaces/ts/eventBridge/connections/index.ts), [`packages/mtw-interfaces/ts/eventBridge/connections/characters`](../../../packages/mtw-interfaces/ts/eventBridge/connections/characters/index.ts), [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md)

### Baseline verification (before edits)

From `lambda/connections/`:

```bash
npm test -- --testPathPattern='charactersDataSource|registerCharacter|app.test'
```

From `lambda/ephemera/`:

```bash
npm test -- --watchAll=false dataSource/positions/ moveCharacter/index.test.ts
```

## Design decisions (resolve during implementation)

- **Perception thread kinds (agreed direction):** two new kinds --- **`sessionOrientationRender`** and **`sessionOrientationAffordances`** --- one row per channel in the same **`(roomId, perspectiveKey)`** bucket. Each carries **`targets: PublishTarget[]`** (session orientation uses **`SESSION#...`**), plus **`characterId`** (required for affordance **`ComponentStackMerge.get`**; render header WML is shared per perspective). **Do not** plumb `targets` / `sessionId` through **`Affordances Requested`**, **`Slice Ready`**, or **`Affordances Pertain`** payloads; that is the anti-pattern threads replace.
- **Affordance steady-state roster path (unchanged in v1):** when no matching affordance thread row exists, **`handleAffordancesPertain`** keeps today's roster re-resolution (`resolveAffordanceTargetsForPerspective`). Session orientation is the first affordance path that **registers** before kicking orchestration; migrating roster refresh to threads is **out of scope** unless blocking.
- **Render terminal path:** **`sessionOrientationRender`** fan-in in **`orchestrate.ts`** (Generating placeholder + terminal on **`Render Pertains`**, same lifecycle as **`roomHeaderBroadcast`**). Widen **`targets`** typing on thread registration commands from **`EphemeraCharacterId[]`** to **`PublishTarget[]`** where needed so **`SESSION#`** validates.
- Whether **`moveCharacter`** should stop kicking passive render / imperative `Perception` header on **same-room** aggregate connect once orientation is owned by **`Character Registered`** (recommended follow-on to avoid double headers).
- Whether **`Character Registered`** orientation runs on **every** registration (including second tab while character already in play) --- **default yes** (session bootstrap); aggregate connect remains suppressed for multi-session.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step lands.

- [X] Phase 1 --- Fix `Character Connected` producer gate (`connections`)
  - [X] Capture **pre-mutation** session count in `registerCharacterMessage` via `transactWrite` Update `successCallback` (`prior.sessions` -> `isFirstSessionForCharacter`).
  - [X] Update [`charactersDataSource.ts`](../../../lambda/connections/dataSource/charactersDataSource.ts) to emit `Character Connected` on **`0 -> 1`** using that signal (remove broken post-mutation `sessions.length === 0` check).
  - [X] Fix [`charactersDataSource.test.ts`](../../../lambda/connections/dataSource/charactersDataSource.test.ts) to assert against **realistic post-registration Dynamo** where appropriate and boundary cases in unit tests.
  - [X] Confirm `Character Disconnected` gate still matches post-teardown semantics (unchanged contract).

  **Phase 1 note:** `isFirstSessionForCharacter` is in-process metadata on `Character Registered` (not on external EventBridge wire). Idempotent re-register skips `successCallback` (Update `ignore`) so the flag stays `false`.

- [X] Phase 2 --- EventBridge + ephemera ingress for `Character Registered`
  - [X] Add **`EphemeraFunction`** CloudWatch rule: `source: mtw.connections`, `detail-type: Character Registered` in [`template.yaml`](../../../template.yaml).
  - [X] Register **`ConnectionsEventSerializer`** on ephemera `eventDeserializers` in [`lambda/ephemera/app.ts`](../../../lambda/ephemera/app.ts) (if not already present for this source).
  - [X] Add subscribed-event guards for `mtw.connections` / `Character Registered` on **`renderOrchestration`** and **`affordanceOrchestration`** (new modules or extend [`subscribedEvents.ts`](../../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts) / affordance analogue).

  **Phase 2 note:** Ingress is wired (`ConnectionsCharacterRegistered` CloudWatch rule, `ConnectionsEventSerializer`, shared guards in [`connectionsCharacterRegistered/subscribedEvents.ts`](../../../lambda/ephemera/dataSource/connectionsCharacterRegistered/subscribedEvents.ts)). Orchestration `receiveEvents` intentionally no-ops until Phase 3 orientation handlers land.

- [ ] Phase 3 --- Session orientation handlers (ephemera)

  **Principle:** Perception threads capture delivery intent once at registration; orchestration and cache emit **`* Pertains`** with routing identity only (`roomId` / `componentId` + `perspectiveKey`). Terminal handlers look up the bucket and read **`registration.targets`** --- same model for render and affordance. **Do not** thread session targets through orchestration ingress or cache outbounds.

  - [ ] **Phase 3a --- Perception thread model (both `* Pertains` terminal paths)**
    - [ ] Add **`sessionOrientationRender`** and **`sessionOrientationAffordances`** to [`localApiEvents.ts`](../../../lambda/ephemera/dataSource/perception/localApiEvents.ts) (`PerceptionThreadRegisterCommand` discriminated union + validators): shared fields **`componentId`** (room), **`perspectiveKey`**, **`characterId`**, **`targets: PublishTarget[]`**, optional **`registrationId`** / **`messageGroupId`**.
    - [ ] Extend [`perceptionThreads.ts`](../../../lambda/ephemera/internalCache/perceptionThreads.ts): thread body types, **`register`** / **`update`** / patch keys, type guards. Render kind: **`Initial | Generating | Terminal`** + **`messageId`** (correlated replace, mirror **`roomHeaderBroadcast`**). Affordance kind: **`Initial | Terminal`** only (affordance channel has no Generating replace pipeline per [multi-channel contract](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md); fresh **`messageId`** per terminal row).
    - [ ] Widen existing **`roomHeaderBroadcast`** (and related) **`targets`** fields to **`PublishTarget[]`** where session orientation reuse would otherwise force ad-hoc casts; keep **`isEphemeraCharacterId`** validation off **`SESSION#`** targets.
    - [ ] **Render terminal:** in [`orchestrate.ts`](../../../lambda/ephemera/dataSource/perception/orchestrate.ts), fan-in **`sessionOrientationRender`** on **`Render Pertains`**, **`Generation Started`**, **`Orchestration Error`**, and **`Generation Deferred`** (parallel branches to **`roomHeaderBroadcast`**: **`metaData.roomChannel: 'render'`**, **`displayMode: 'header'`**, **`registration.targets`**, remove row after terminal).
    - [ ] **Affordance terminal:** refactor [`handleAffordancesPertain.ts`](../../../lambda/ephemera/dataSource/perception/handleAffordancesPertain.ts) to **`list(roomId, perspectiveKey)`**, handle **`sessionOrientationAffordances`** rows first (compose via **`ComponentStackMerge.get(registration.characterId, roomId)`**, **`PublishMessage`** with **`registration.targets`**, **`metaData.roomChannel: 'affordances'`**, new **`messageId`** per row, **`remove`** thread after publish). **Fallback:** no matching affordance thread -> existing **`resolveAffordanceTargetsForPerspective`** + [`publishAffordancePerceptionForCharacters.ts`](../../../lambda/ephemera/dataSource/perception/publishAffordancePerceptionForCharacters.ts).
    - [ ] Extend [`publishAffordancePerceptionForCharacters.ts`](../../../lambda/ephemera/dataSource/perception/publishAffordancePerceptionForCharacters.ts) (or thin helper) so thread path can pass **`PublishTarget[]`** separately from merge **`characterId`** (today **`targets`** === **`characterId`**).
    - [ ] Unit tests: thread registration validators; **`orchestrate`** session render fan-in (Generating + terminal, **`SESSION#`** targets); **`handleAffordancesPertain`** with registered affordance thread vs roster fallback.

  - [ ] **Phase 3b --- Orientation kick (orchestration ingress, no delivery plumbing)**
    - [ ] Shared helper **`handleCharacterRegisteredOrientation`** (location TBD: e.g. [`connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts`](../../../lambda/ephemera/dataSource/connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts)): load character room from **`Meta::Character`**, assets, canon-filtered perspective ([`resolveCharacterRoomPerspectiveForRoom`](../../../lambda/ephemera/dataSource/perception/kickRoomHeaderBroadcast.ts)); no-op when room or perspective missing.
    - [ ] Register **two** threads via **`sendPerceptionThreadRegistered`**: **`sessionOrientationRender`** + **`sessionOrientationAffordances`**, same bucket, **`targets: [\`SESSION#${sessionId}\`]`**, **`characterId`** from event.
    - [ ] Kick **`sendRenderRequested`** and **`sendAffordancesRequested`** (reason TBD --- e.g. **`roster`** or dedicated **`sessionOrientation`**) with **`roomId` + `perspective` only**.
    - [ ] Wire **`Character Registered`** branches in [`renderOrchestration/index.ts`](../../../lambda/ephemera/dataSource/renderOrchestration/index.ts) and [`affordanceOrchestration/index.ts`](../../../lambda/ephemera/dataSource/affordanceOrchestration/index.ts) **`receiveEvents`** (replace Phase 2 no-op).
    - [ ] Unit tests: orientation helper registers two threads and enqueues both orchestration kicks; duplicate **`Character Registered`** tolerant.

  - [ ] **Phase 3c --- Integration proof**
    - [ ] Integration-style test: **`Character Registered`** alone (no **`Character Connected`**) delivers render + affordance **`PublishMessage`** rows to **`SESSION#...`** through full in-process bus path (thread register -> orchestration -> cache -> **`* Pertains`** -> perception terminal).
    - [ ] Assert render row uses correlated **`messageId`** (Generating then terminal overwrite); affordance row uses **new** **`messageId`** (uncoupled channel).

- [ ] Phase 4 --- Detangle docs and trim conflated behavior
  - [ ] Update [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) --- separate producer outcomes, boundary semantics, consumer map.
  - [ ] Update [`documentation/dataSources/connections/index.md`](../../../documentation/dataSources/connections/index.md) --- add ephemera consumers for **`Character Registered`** vs **`Character Connected`**.
  - [ ] Update [`lambda/ephemera/AGENT.md`](../../../lambda/ephemera/AGENT.md) and [`lambda/ephemera/AGENT.event.md`](../../../lambda/ephemera/AGENT.event.md) --- positions = world; orientation = registration intake.
  - [ ] Update [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) --- clarify **`Character Registered`** (session correlation) vs presence events (aggregate boundary).
  - [ ] Optional: note in [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../lambda/ephemera/dataSource/perception/AGENT.md) delivery-path table (session orientation rows: **`sessionOrientationRender`** + **`sessionOrientationAffordances`**; affordance **`Affordances Pertain`** thread lookup).
  - [ ] Evaluate removing same-room header side effects from [`moveCharacter`](../../../lambda/ephemera/moveCharacter/index.ts) once orientation is verified (separate commit within this initiative if low risk).

- [ ] Phase 5 --- End-to-end verification
  - [ ] Deploy connections + ephemera; pick character after login; confirm RoomHeader (render + affordance) on client.
  - [ ] Confirm second session / reconnect scenarios: orientation without duplicate world arrival when character already in play.
  - [ ] CloudWatch: `Character Registered` and (when boundary applies) `Character Connected` on event bus; ephemera logs for both handler paths.

## Verification

After each phase, re-run targeted tests.

**Connections (`lambda/connections/`):**

```bash
npm test -- --testPathPattern='charactersDataSource|registerCharacter|app.test'
```

**Ephemera (`lambda/ephemera/`):**

```bash
npm test -- --watchAll=false \
  dataSource/positions/ \
  dataSource/renderOrchestration/ \
  dataSource/affordanceOrchestration/ \
  dataSource/perception/ \
  moveCharacter/index.test.ts
```

**Manual / ops checks:**

- Event bus log group [`/mtw/${TablePrefix}/eventBus`](../../../template.yaml): entries for `mtw.connections` / `Character Registered` and, on first session, `mtw.connections.characters` / `Character Connected`.
- Client: sticky RoomHeader appears after character select without API Gateway ISE on `registercharacter` (prerequisite: [`returnValue`](../../../lambda/connections/returnValue/index.ts) WebSocket wrap --- already fixed).

## Progress

| Milestone | Status |
| --- | --- |
| Task plan authored | Done |
| `Character Connected` gate fixed + tests | Done |
| EventBridge + ephemera `Character Registered` ingress | Done |
| Perception thread model (dual `* Pertains` fan-in) | Not started |
| Session orientation kick + orchestration handlers | Not started |
| Session orientation integration tests | Not started |
| Documentation detangle | Not started |
| E2E verified in deployed environment | Not started |

## Durable doc handoff (when done)

Move steady-state architecture into package docs (not this file):

- [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) --- dual outcomes + consumer map
- [`documentation/dataSources/connections/index.md`](../../../documentation/dataSources/connections/index.md)
- [`lambda/ephemera/AGENT.md`](../../../lambda/ephemera/AGENT.md) + orchestration/perception AGENT files
- [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md)

Then delete or archive this task plan per [`taskPlanning/AGENT.md`](../../AGENT.md).
