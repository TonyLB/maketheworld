# Action Parse DataSource Plan

**Status:** In progress. Phase 1 is complete; next step is Phase 2 parser-result contract hardening.

## Purpose

Create a staged implementation path for action parsing in ephemera:

1. Land a defined, minimal closed loop using the existing `command` WebSocket API shape.
2. Add an LLM-backed parser path that extracts intent from free-form command text.
3. Grow action branches that implement affordance-specific behavior and response patterns over time.

This plan is task-scoped and should be retired after the action parse initiative is complete.

## Scope split

### Defined work (ready now)

- `mtw.ephemera.actions` inert bus-only DataSource exists and subscribes.
- `api.ephemera` synthetic `Parse Requested` exists (`command: string` payload).
- Need to close the loop by routing incoming WebSocket `command` requests into this synthetic path and returning correlated success with `RequestId`.

### Undefined work (design + incremental implementation)

- LLM parser architecture (prompting, output schema, validation, fallback behavior).
- Action branch taxonomy and per-branch response semantics (which branches return immediate success, deferred progress, errors, or multi-step conversation outputs).
- Evolution from imperative parsing to DataSource-driven branch handling.

## Getting started

1. Read task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. Review existing ephemera command ingress: [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts)
3. Review synthetic command contracts:
   - [`lambda/ephemera/dataSource/localApiEvents.ts`](../../../../../lambda/ephemera/dataSource/localApiEvents.ts)
   - [`lambda/ephemera/dataSource/apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts)
   - [`lambda/ephemera/dataSource/actions/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/subscribedEvents.ts)
4. Review existing imperative parser/executor baseline:
   - [`lambda/ephemera/parse/index.ts`](../../../../../lambda/ephemera/parse/index.ts)
   - [`lambda/ephemera/parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts)
5. Review wire contracts used by WebSocket request/response correlation:
   - [`packages/mtw-interfaces/ts/ephemera.ts`](../../../../../packages/mtw-interfaces/ts/ephemera.ts)
   - [`charcoal-client/src/slices/lifeLine/index.api.ts`](../../../../../charcoal-client/src/slices/lifeLine/index.api.ts)

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [X] Phase 1 - close the no-op request loop on `command`
  - [X] Route `isCommandAPIMessage` handling from direct imperative parse toward `sendParseRequested(...)` synthetic dispatch (or equivalent handoff bridge).
  - [X] Handle `Parse Requested` in `mtw.ephemera.actions` by emitting correlated immediate success when `RequestId` is present.
  - [X] Add/update tests proving: outbound `command` request receives a `RequestId`-correlated success response even with no implemented action branches.
  - [X] Keep behavior explicit for currently unsupported/empty parse outcomes.

- [ ] Phase 2 - define parser result contract (pre-LLM hardening)
  - [ ] Define internal parse-result type(s): intent key, extracted slots/entities, confidence, and parse diagnostics.
  - [ ] Decide authoritative validation boundary (schema guard in lambda vs parser wrapper).
  - [ ] Define fallback behavior when parse is invalid or low-confidence.
  - [ ] Add tests for parse-result validation and fallback handling.

- [ ] Phase 3 - implement LLM parser vertical slice
  - [ ] Add prompt + invocation path for command-to-intent parsing.
  - [ ] Validate structured output and normalize to internal parse-result contract.
  - [ ] Add deterministic fallback path when model output fails validation or call errors.
  - [ ] Add tests with fixed fixtures/mocks for success, low-confidence, malformed output, and provider failure.

- [ ] Phase 4 - action branch framework
  - [ ] Define branch registry/routing by intent (single dispatch point).
  - [ ] Implement first minimal branch set aligned with current affordances (e.g. look, move, home) through the new path.
  - [ ] Ensure branch outputs map cleanly to response patterns (immediate success, error, or deferred conversation step).
  - [ ] Preserve parity checks against legacy imperative behavior while migrating.

- [ ] Phase 5 - affordance expansion and response patterns
  - [ ] Add new branch families as affordances are implemented.
  - [ ] Add branch-specific response contracts (including richer payloads where needed).
  - [ ] Decide which flows should remain single-response (`socketDispatchPromise`) vs multi-message (`socketDispatchConversation`).
  - [ ] Expand test matrix for branch behavior and client-visible contract stability.

- [ ] Phase 6 - migration and cleanup
  - [ ] Remove/retire legacy imperative parse path once branch parity is acceptable.
  - [ ] Update durable docs in code-adjacent `AGENT.md` files.
  - [ ] Delete this plan when completed (or archive if still actively referenced).

## Material decisions to confirm early

- Keep using existing WebSocket `message: 'command'` as ingress shape (recommended for minimal churn) vs introduce new API message type.
- Correlated success shape for parse acceptance: reuse `EphemeraCommandSuccess` with a new `command` variant (recommended) vs generic success payload.
- Terminal semantics per request type: single correlated response now, with optional future migration to conversation-style multi-message streams for long-running parse/branch workflows.

## Verification

- Build/typecheck ephemera path after each phase (`lambda/ephemera` build).
- Add/update unit tests for:
  - ingress routing (`command` -> synthetic parse request),
  - actions DataSource parse ack behavior,
  - parser contract validation and fallback,
  - branch dispatch and branch-specific outcomes.
- For client correlation behavior, verify request resolution by matching top-level `RequestId` in returned payload.
- Phase 1 verification completed:
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npm run test -- --runInBand app.test.ts dataSource/actions/index.test.ts`
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npm run build`
  - `ReadLints` clean on edited files.

## Progress

| Milestone | Status |
| --- | --- |
| Inert `mtw.ephemera.actions` DataSource stub | Done |
| Synthetic `api.ephemera` `Parse Requested` event contract and subscription guard | Done |
| Closed-loop `command` -> `Parse Requested` -> correlated success | Done |
| Legacy imperative parser retained as explicit commented reference in `app.ts` | Done |
| LLM parser contract and implementation | Not started |
| Action branch framework and migration from imperative parse | Not started |
