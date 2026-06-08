# Character Registered vs Character Connected (`connections` presence split)

**Status:** In progress. Next step: implement session orientation handlers (Phase 3) for `Character Registered` on render + affordance orchestration.

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
| **`Character Registered`** | `mtw.connections` | `CHARACTER#${characterId}` | Every successful `registercharacter` (already implemented) | **New:** `renderOrchestration` + `affordanceOrchestration` (+ `perception` fan-in) for **session orientation** |
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
- **Session orientation (new):** on **`Character Registered`**, resolve the character's current room from ephemera `Meta::Character`, kick **render** and **affordance** orchestration with delivery correlated to **`SESSION#${sessionId}`** (see [`publishMessage/index.ts`](../../../lambda/ephemera/publishMessage/index.ts) session targets). Register a **`mtw.ephemera.perception`** thread kind appropriate for terminal **`PublishMessage`** fan-in (new `threadKind` or documented reuse --- decide in implementation slice).
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

- **Perception thread kind** for session orientation (`sessionCharacterRegistered` vs extending an existing kind with `targets: SESSION#...`).
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
  - [ ] Implement **`handleCharacterRegisteredOrientation`** (name TBD): load character room + assets, compute perspective, register **`mtw.ephemera.perception`** thread with **`targets: [\`SESSION#${sessionId}\`]`**, kick **`sendRenderRequested`** and affordance orchestration for that room/perspective.
  - [ ] Wire terminal **`PublishMessage`** (render + affordance channels) through existing **`orchestrate.ts`** / **`handleAffordancesPertain`** patterns with **session-scoped targets**.
  - [ ] Add tests: registration-only path delivers header targets to **`SESSION#...`**; **`Character Connected`** not required for orientation test case.

- [ ] Phase 4 --- Detangle docs and trim conflated behavior
  - [ ] Update [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) --- separate producer outcomes, boundary semantics, consumer map.
  - [ ] Update [`documentation/dataSources/connections/index.md`](../../../documentation/dataSources/connections/index.md) --- add ephemera consumers for **`Character Registered`** vs **`Character Connected`**.
  - [ ] Update [`lambda/ephemera/AGENT.md`](../../../lambda/ephemera/AGENT.md) and [`lambda/ephemera/AGENT.event.md`](../../../lambda/ephemera/AGENT.event.md) --- positions = world; orientation = registration intake.
  - [ ] Update [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) --- clarify **`Character Registered`** (session correlation) vs presence events (aggregate boundary).
  - [ ] Optional: note in [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../lambda/ephemera/dataSource/perception/AGENT.md) delivery-path table (new row for session orientation).
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
| Session orientation handlers (render + affordance + perception) | Not started |
| Documentation detangle | Not started |
| E2E verified in deployed environment | Not started |

## Durable doc handoff (when done)

Move steady-state architecture into package docs (not this file):

- [`lambda/connections/AGENT.md`](../../../lambda/connections/AGENT.md) --- dual outcomes + consumer map
- [`documentation/dataSources/connections/index.md`](../../../documentation/dataSources/connections/index.md)
- [`lambda/ephemera/AGENT.md`](../../../lambda/ephemera/AGENT.md) + orchestration/perception AGENT files
- [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md)

Then delete or archive this task plan per [`taskPlanning/AGENT.md`](../../AGENT.md).
