# Character Sub-DataSource Planning (`mtw.connections.characters`)

**Status:** In progress. Phase 1 (contracts and docs) is complete. Next: Phase 2 derived DataSource scaffold for `mtw.connections.characters`, then registration ingress and ephemera cutover.

## Purpose

Create a task-scoped plan to introduce a derived `mtw.connections.characters` DataSource that consumes connection-domain lifecycle events and emits canonical character presence transitions:

- `Character Connected`
- `Character Disconnected`

This plan also covers the registration-authority refactor so character registration ingress no longer targets `ephemera` directly and instead flows through `connections`.

This document is task-scoped and should be removed or archived after the initiative is complete.

## Scope and boundaries

### In scope

- Add or formalize `Character Registered` as a `mtw.connections` event used by a derived character-presence lane.
- Define `mtw.connections.characters` subscription surface (at minimum `Character Registered` and `Session Disconnect`).
- Enrich subscribed events with authoritative lookup data (session and character adjacency/session lists) to compute first/last-session transitions.
- Emit canonical `Character Connected`/`Character Disconnected` events from connections-owned authority.
- Refactor registration ingress so the authoritative registration write path is in `connections`, with `ephemera` subscribing to presence transitions for denormalized updates (for example `Meta::Room.activeCharacters`).

### Out of scope for this slice

- Full redesign of all ephemera room-presence semantics beyond what is required to consume new connections-owned events.
- Unrelated event taxonomy cleanups outside connections/ephemera boundaries.
- Broad websocket/API contract redesign outside registration and disconnect lifecycle paths.

## Getting started

1. Task-planning conventions: [`taskPlanning/AGENT.md`](../../AGENT.md)
2. Root complex-task workflow: [`AGENT.md` "Getting Started pattern for complex tasks"](../../../../AGENT.md#getting-started-pattern-for-complex-tasks)
3. Connections authority and current disconnect behavior:
   - [`lambda/connections/AGENT.md`](../../../../lambda/connections/AGENT.md)
   - [`lambda/connections/dataSource/index.ts`](../../../../lambda/connections/dataSource/index.ts)
   - [`lambda/connections/staleSessionTeardown/index.ts`](../../../../lambda/connections/staleSessionTeardown/index.ts)
   - [`lambda/connections/disconnect/index.ts`](../../../../lambda/connections/disconnect/index.ts)
4. Existing event contracts and serializers:
   - [`packages/mtw-interfaces/ts/eventBridge/connections/index.ts`](../../../../packages/mtw-interfaces/ts/eventBridge/connections/index.ts)
   - [`packages/mtw-interfaces/ts/eventBridge/connections/characters/index.ts`](../../../../packages/mtw-interfaces/ts/eventBridge/connections/characters/index.ts)
   - [`template.yaml`](../../../../template.yaml) (EventBridge subscriptions and wiring)
5. Current ephemera registration and derivative handling to be migrated:
   - [`lambda/ephemera/registerCharacter/index.ts`](../../../../lambda/ephemera/registerCharacter/index.ts)
   - [`lambda/ephemera/disconnectMessage/index.ts`](../../../../lambda/ephemera/disconnectMessage/index.ts)
   - [`lambda/ephemera/app.ts`](../../../../lambda/ephemera/app.ts)

### Testing orientation

- Durable testing authority for this slice is the local package setup in:
  - [`lambda/connections/package.json`](../../../../lambda/connections/package.json)
  - [`lambda/connections/jest.config.js`](../../../../lambda/connections/jest.config.js)
  - plus targeted tests in `lambda/ephemera` for downstream consumer behavior.
- Run commands from each package directory (`lambda/connections/` or `lambda/ephemera/`), using explicit `--config` paths when running targeted files.
- Baseline before edits:
  - `npx jest --config "/Users/anthonylower-basch/Code/maketheworld/lambda/connections/jest.config.js" --runInBand app.test.ts`

## Current-state observations

- `connections` already owns `Session Disconnect` emission and stale-session teardown.
- Character-session adjacency mutation is currently split:
  - connect/registration path in `ephemera` (`registerCharacter`)
  - disconnect cleanup path in `connections` (`atomicallyRemoveCharacterAdjacency`)
- First/last transition semantics are partially present today (`sessions.length > 1` suppression on register, delete-on-empty behavior on disconnect), but owned in different lambdas.
- Shared contracts for `Character Registered`, `Character Connected`, and `Character Disconnected` now live in [`packages/mtw-interfaces/ts/eventBridge/connections`](../../../../packages/mtw-interfaces/ts/eventBridge/connections); wiring and emission are still pending later phases.

## Target architecture (task outcome)

- `connections` is authoritative for character-session membership transitions.
- Registration ingress writes and transition checks happen in `connections` paths.
- `mtw.connections.characters` (derived DataSource) consumes normalized lifecycle events plus lookup context to emit character presence transitions with at-least-once semantics (duplicates acceptable under race/retry):
  - intended connect boundary (`0 -> 1`) => `Character Connected`
  - intended disconnect boundary (`1 -> 0`) => `Character Disconnected`
- `ephemera` becomes subscriber/projection owner for denormalizations (`Meta::Room.activeCharacters`, room/world messaging), not transition authority.

## Contract decisions (locked)

- Delivery semantics:
  - `Character Connected` and `Character Disconnected` are **at least once**.
  - Duplicate delivery is allowed (for retries and concurrent registration/disconnect windows).
  - Consumers must be idempotent for user-visible side effects.
- Producer-side connect/disconnect checks in derived lane:
  - For `Character Connected`, query `CHARACTER#...` session adjacency count before mutation/enrichment updates.
  - If pre-check count is `0`, publish `Character Connected`.
  - Always apply the registration adjacency/session update regardless of whether event was published.
  - Do not add cross-writer locking to prevent duplicate emits under same-window concurrency.
  - Mirror this philosophy for `Character Disconnected` around last-session teardown windows.
- Canonical event shape:
  - `Character Registered` is emitted on `mtw.connections`.
  - `Character Connected` and `Character Disconnected` are emitted on `mtw.connections.characters`.
  - `streamKey`: `CHARACTER#${characterId}` for all three event types.
  - `Character Registered` payload: `{ type: 'Character Registered', characterId: EphemeraCharacterId, sessionId: string, timestamp: string }`
  - `Character Connected` payload: `{ type: 'Character Connected', characterId: EphemeraCharacterId, sessionId: string, timestamp: string }`
  - `Character Disconnected` payload: `{ type: 'Character Disconnected', characterId: EphemeraCharacterId, sessionId: string, timestamp: string }`
- Consumer-side idempotency gate:
  - `ephemera` uses `Meta::Room.activeCharacters` `optimisticUpdate` conditional transitions as the arrival/departure side-effect gate.
  - Arrival/departure world messaging only fires when conditional projection updates actually change room presence.
- Ownership split (resolved):
  - `connections` updates the `connections` Dynamo table and emits character lifecycle events.
  - `ephemera` handles denormalized room-presence writes and user-facing arrival/departure messaging.
- Cutover tolerance (resolved):
  - Temporary duplicate arrival/departure messages across intermediate commits are acceptable in this development-system migration.
  - Requirement is to eliminate persistent double-publish behavior by task completion.

## Key design decisions to resolve

- Any remaining staging constraints needed if temporary duplicate messages become noisy during development verification.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step lands.

- [X] Phase 1 - contracts and authority alignment
  - [X] Extend `mtw.connections` event contracts to include `Character Registered` using locked canonical shape.
  - [X] Define `mtw.connections.characters` event contracts for `Character Connected` and `Character Disconnected` using locked canonical shapes.
  - [X] Define serializer/deserializer guards and tests in `packages/mtw-interfaces`.
  - [X] Document at-least-once delivery semantics and duplicate-tolerant consumer requirements in contract docs.

- [X] Phase 2 - derived DataSource scaffold (`mtw.connections.characters`)
  - [X] Add DataSource module wiring and subscribed-event guards for `Character Registered` and `Session Disconnect`.
  - [X] Implement enrichment lookups and pre-check count logic on `CHARACTER#...` adjacency for connect/disconnect transition intent.
  - [X] Emit `Character Connected`/`Character Disconnected` with at-least-once semantics (duplicate emits acceptable).
  - [X] Add focused tests for churn scenarios (multiple sessions for one character, out-of-order retries, duplicate events).

- [X] Phase 3 - registration ingress refactor
  - [X] Introduce/route registration API/event ingress through `connections` instead of `ephemera`.
  - [X] Move authoritative adjacency/session mutation from `ephemera/registerCharacter` into connections-owned path.
  - [X] Keep temporary compatibility bridge only as needed for safe rollout; mark with explicit removal criteria.

- [ ] Phase 4 - ephemera consumer cutover
  - [ ] Update ephemera to subscribe to `Character Connected`/`Character Disconnected` and perform denormalized updates (`Meta::Room.activeCharacters`, room notifications).
  - [ ] Remove direct registration authority assumptions in ephemera handlers.
  - [ ] Preserve user-visible behavior parity (arrival/departure messaging, room update triggering).

- [ ] Phase 5 - deployment safety and cleanup
  - [ ] Update `template.yaml` EventBridge rules and lambda subscriptions for new event types/sources.
  - [ ] Add runbook notes for dual-write/dual-consume avoidance during rollout.
  - [ ] Remove obsolete bridge paths and update durable `AGENT.md` docs after cutover is stable.
    - [ ] Remove bridge-only register behavior in `lambda/ephemera/app.ts` that returns `messageType: 'Error'` for `registercharacter` on `service: 'ephemera'`.
    - [ ] Remove any remaining bridge-specific registration test assertions in `lambda/ephemera/app.test.ts`.
    - [ ] Verify no lingering registration authority in `lambda/ephemera/registerCharacter/index.ts` (no direct adjacency/session mutation path used by ingress).
    - [ ] Confirm registration steady-state remains `service: 'connections'` -> `lambda/connections/ingress.ts` -> `lambda/connections/registerCharacter/index.ts`.
    - [ ] Validate completion signal: no production `registercharacter` traffic on `service: 'ephemera'` over agreed observation window.

## Verification

Run from the noted package directory.

- Contracts/interfaces (`packages/mtw-interfaces/`):
  - `npx jest --runInBand ts/eventBridge/connections/index.test.ts ts/eventBridge/connections/characters/index.test.ts`
- Connections lifecycle and derived DataSource (`lambda/connections/`):
  - `npx jest --config "/Users/anthonylower-basch/Code/maketheworld/lambda/connections/jest.config.js" --runInBand app.test.ts dataSource/index.test.ts staleSessionTeardown/index.test.ts`
- Ephemera subscription/derivative behavior (`lambda/ephemera/`):
  - `npx jest --config "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera/jest.config.js" --runInBand app.test.ts registerCharacter/index.test.ts disconnectMessage/index.test.ts`
- Optional integration confidence pass (repo root):
  - `npm test --workspaces --if-present`

## Progress

| Milestone | Status |
| --- | --- |
| Create task plan | Done |
| Define contracts and authority ownership | Done |
| Implement `mtw.connections.characters` derived DataSource | Done |
| Migrate registration ingress to connections | Done |
| Cut ephemera to subscriber/projection role | Not started |
| Update durable docs and remove bridges | Not started |
