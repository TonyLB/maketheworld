# Action Parse DataSource Plan

**Status:** In progress. Phases 1-3 are complete; Phase 4 has started with `LookRoom` as a shipped branch pattern.

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

## Durable branch pattern note

The `LookRoom` affordance is now the reference branch for event-driven cross-DataSource behavior:

- deterministic `look` / `l` fast path plus discriminate-intent `LookRoom` classification for paraphrases;
- actions publishes `Look Command Requested` (typed payload + guard);
- render orchestration subscriber enforces lane ordering (`Perception Thread Registered` -> `flush(lane)` -> default-lane `Render Requested`).

Use this as the baseline when adding similar affordances that require perception/render coordination.

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)). A category can be light if it does not apply yet; keep **Why** / **Focus** so the next reader knows what to skim vs study.

1. **Understand project foundations**
   - **Why**: Task plans sit under [`taskPlanning/`](../../../../); root navigation explains how docs fit together and when this plan retires.
   - **Read**: Root [`AGENT.md`](../../../../../AGENT.md) (overview, ephemera links, Getting Started pattern). [`taskPlanning/AGENT.md`](../../../../AGENT.md) (what belongs in this file vs durable `AGENT.md`, **Recommended order** checkbox rules, verification expectations).

2. **Read this document**
   - **Why**: Phases and scope split change over time; the durable checklist is **Recommended order** and **Verification**.
   - **Focus**: **Purpose** and **Scope split** for intent; **Recommended order** for the current milestone (next: Phase 4); **Material decisions** for open product choices.

3. **Understand core integration points**
   - **Why**: Action parse work crosses WebSocket ingress, synthetic `api.ephemera` events, the `mtw.ephemera.actions` DataSource, and client correlation.
   - **Focus**: `command` string in, `Parse Requested` on the bus, handler outcomes correlated with `RequestId` (see **Material decisions** and interfaces below).
   - **Primary files**: [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts) (ingress and handoff); [`lambda/ephemera/dataSource/localApiEvents.ts`](../../../../../lambda/ephemera/dataSource/localApiEvents.ts), [`lambda/ephemera/dataSource/apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts), [`lambda/ephemera/dataSource/actions/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/subscribedEvents.ts) (synthetic contracts and subscription helpers).

4. **Review implemented code**
   - **Why**: Phase 3 adds an LLM path; reuse established Bedrock **Converse** + JSON validation patterns and the existing parse-result boundary.
   - **Parser contract and handler**: [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts) (terminal parse union + shared guards), [`discriminateIntent/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/baseClasses.ts) (intent-discrimination types + guards), [`discriminateIntent/intentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.ts), [`discriminateIntent/buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts), [`enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md), [`enrich/acmeOrder/buildPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts), [`enrich/acmeOrder/interpretAndFinalize.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/interpretAndFinalize.ts), [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts).
   - **Legacy imperative baseline** (parity / migration context): [`lambda/ephemera/parse/index.ts`](../../../../../lambda/ephemera/parse/index.ts), [`lambda/ephemera/parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts).
   - **Bedrock invocation reference** (Nova text in, JSON out, timeout): [`invokeBedrockConverseText.ts`](../../../../../lambda/ephemera/generateExample/invokeBedrockConverseText.ts), [`invokeBedrockParseCommand.ts`](../../../../../lambda/ephemera/generateExample/invokeBedrockParseCommand.ts), [`invokeBedrockRoomDescription.ts`](../../../../../lambda/ephemera/generateExample/invokeBedrockRoomDescription.ts).

5. **Check testing patterns**
   - **Why**: Ephemera uses Jest from `lambda/ephemera`; keep parity with existing action-parse and ingress tests.
   - **Files**: [`lambda/ephemera/dataSource/actions/parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts), [`lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.test.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.test.ts), [`lambda/ephemera/dataSource/actions/index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts); ingress routing in [`lambda/ephemera/app.test.ts`](../../../../../lambda/ephemera/app.test.ts) where `command` / parse paths are covered.
   - **Wire contracts** (types and client correlation expectations): [`packages/mtw-interfaces/ts/ephemera.ts`](../../../../../packages/mtw-interfaces/ts/ephemera.ts), [`charcoal-client/src/slices/lifeLine/index.api.ts`](../../../../../charcoal-client/src/slices/lifeLine/index.api.ts).

6. **Identify next task**
   - **Why**: Progress lives in **Recommended order**; readers often open only this plan.
   - **Focus**: First unchecked parent phase and its nested items (see [`taskPlanning/AGENT.md` Recommended order checkboxes](../../../../AGENT.md#recommended-order-checkboxes)). After shipping a slice, mark checkboxes and refresh **Verification** to match.

7. **Run tests before starting**
   - **Why**: Confirms baseline before edits; commands are Jest from `lambda/ephemera` (not Vitest).
   - **Commands**: From **Verification** in this document (e.g. targeted `npm run test -- --runInBand ...` for actions and `npm run build`). Extend with any new test files you add for Phase 3.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [X] Phase 1 - close the no-op request loop on `command`
  - [X] Route `isCommandAPIMessage` handling from direct imperative parse toward `sendParseRequested(...)` synthetic dispatch (or equivalent handoff bridge).
  - [X] Handle `Parse Requested` in `mtw.ephemera.actions` by emitting correlated immediate success when `RequestId` is present.
  - [X] Add/update tests proving: outbound `command` request receives a `RequestId`-correlated success response even with no implemented action branches.
  - [X] Keep behavior explicit for currently unsupported/empty parse outcomes.

- [X] Phase 2 - define parser result contract (pre-LLM hardening)
  - [X] Define internal parse-result types: discriminated union by intent (`type`); slots/entities as per-variant fields (e.g. `targetId`, `orders`); `confidence` on all non-error outcomes (typically `[0, 1]`). Parse diagnostics: explicitly deferred.
  - [X] Validation boundary: type guards and confidence/range checks in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts); handler in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) branches on guards before effects.
  - [X] Fallback / edge handling: `Error`, `Unknown`, `Unimplemented`; WorldOOCMessage user copy; navigation exit validation against current room exits.
  - [X] Tests: [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts) (guards), [`index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts) (handler branches).

- [X] Phase 3 - implement LLM parser vertical slice
  - [X] Add prompt + invocation path for command-to-intent parsing.
  - [X] Validate structured output and normalize to internal parse-result contract.
  - [X] Add deterministic fallback path when model output fails validation or call errors.
  - [X] Add tests with fixed fixtures/mocks for success, low-confidence, malformed output, and provider failure.

- [ ] Phase 4 - action branch framework
  - [ ] Define branch registry/routing by intent (single dispatch point).
  - [X] Implement first minimal branch set aligned with current affordances (initial shipped branch: `LookRoom`).
  - [ ] Extend branch set (e.g. move, home) through the new path.
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
- Phase 2 verification: `npm run test -- --runInBand dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts` and `npm run build` in `lambda/ephemera`.
- Phase 3 verification: same Jest targets as Phase 2 (parse pipeline + handler); `npm run build` in `lambda/ephemera`. LLM path covered with mocked `invokeBedrockParseCommand`; validation/fallback covered in `discriminateIntent/intentClassification.test.ts` (`interpretIntentClassificationBody`).

## Progress

| Milestone | Status |
| --- | --- |
| Inert `mtw.ephemera.actions` DataSource stub | Done |
| Synthetic `api.ephemera` `Parse Requested` event contract and subscription guard | Done |
| Closed-loop `command` -> `Parse Requested` -> correlated success | Done |
| Legacy imperative parser retained as explicit commented reference in `app.ts` | Done |
| Phase 2 parse-result contract (`parseCommand.ts` union, confidence, guards, handler tests) | Done |
| LLM parser contract and implementation | Done |
| Action branch framework and migration from imperative parse | Not started |
