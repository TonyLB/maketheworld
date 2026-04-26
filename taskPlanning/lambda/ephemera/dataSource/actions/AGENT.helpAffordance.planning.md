# Help Affordance Planning (`mtw.ephemera.actions`)

**Status:** In progress. Planning drafted; next step is Phase 1 parser contract wiring for `Help`.

## Purpose

Plan and track implementation of a parse affordance that recognizes player help intent and publishes a `CoyoteGameHelpMessage` to the character who issued the command.

This is a task-scoped plan under `taskPlanning/` and should be removed or archived when this initiative is complete.

## Scope

### In scope

- Add a parse affordance/result variant for help intent in `mtw.ephemera.actions`.
- Route that affordance in actions receive handling to `PublishMessage` with `displayProtocol: 'CoyoteGameHelpMessage'` targeting the requesting character.
- Keep request correlation behavior intact (`ReturnValue` success path) for parse request acceptance.
- Add/adjust tests in actions and publish/wire layers as needed for confidence in behavior.

### Out of scope

- Redesigning help card visual presentation in client (already added display protocol/component path exists).
- Adding new stream-event contracts for help (goal is local publish to requester only).
- Broad parser taxonomy refactors unrelated to this affordance.

## Getting started

Follow the root getting-started pattern for complex tasks and read documents in this order:

1. **Task-planning conventions**
   - **Why:** Keep this plan process-focused and disposable after shipping.
   - **Read:** [`taskPlanning/AGENT.md`](../../../../AGENT.md).

2. **Actions steady-state and implementation docs**
   - **Why:** `AGENT.md` now carries architecture/contracts; implementation guide has affordance checklist.
   - **Read:** [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md), [`lambda/ephemera/dataSource/actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md).

3. **Actions code touchpoints for this feature**
   - **Why:** Parse result contract, parser routing, and receive branch live here.
   - **Read:** [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts), [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`parseCommandIntentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts), [`buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts), [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts), [`index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts), [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts).

4. **Message protocol and wire translation**
   - **Why:** Ensure publish payload is supported end-to-end to client wire message.
   - **Read:** [`lambda/ephemera/messageBus/baseClasses.ts`](../../../../../lambda/ephemera/messageBus/baseClasses.ts), [`lambda/ephemera/publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts), [`packages/mtw-interfaces/ts/messages.ts`](../../../../../packages/mtw-interfaces/ts/messages.ts), [`packages/mtw-interfaces/ts/messages.test.ts`](../../../../../packages/mtw-interfaces/ts/messages.test.ts), [`packages/mtw-interfaces/ts/ephemera.test.ts`](../../../../../packages/mtw-interfaces/ts/ephemera.test.ts).

5. **Client render path (verify no regressions)**
   - **Why:** Confirm `CoyoteGameHelpMessage` remains correctly routed/rendered.
   - **Read:** [`charcoal-client/src/components/Message/index.tsx`](../../../../../charcoal-client/src/components/Message/index.tsx), [`charcoal-client/src/components/Message/CoyoteHelpMessage.tsx`](../../../../../charcoal-client/src/components/Message/CoyoteHelpMessage.tsx), related tests in the same folder.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark each nested item as you finish it.

- [X] Phase 1 - add parser/result contract for help affordance
  - [X] Add `Help` parse result variant and type guard in `actions/baseClasses.ts`.
  - [X] Decide and implement deterministic fast-path command forms (for example `help`, optionally `?`) in `parseCommand.ts`.
  - [X] Add Step A help-intent classification path and keep prompt labels + interpretation + guards aligned across prompt builder/interpreter/base classes.
  - [X] Add parser unit tests for deterministic and/or Step A help detection paths.

- [X] Phase 2 - route help affordance in actions handler
  - [X] Add `Help` branch in `actions/index.ts` receive flow.
  - [X] Publish `PublishMessage` with `displayProtocol: 'CoyoteGameHelpMessage'` targeted to the requesting character.
  - [X] Preserve existing parse acceptance `ReturnValue` behavior and avoid changing unrelated fallback branches.
  - [X] Add/extend `actions/index.test.ts` to validate publish target/protocol and unchanged success correlation behavior.

- [X] Phase 3 - verify message protocol/wire integration for this path
  - [X] Confirm `PublishCoyoteGameHelpMessage` typing/guards in `lambda/ephemera/messageBus/baseClasses.ts` match handler usage.
  - [X] Confirm `publishMessage/index.ts` maps bus payload to wire `DisplayProtocol: 'CoyoteGameHelpMessage'` correctly.
  - [X] Add/adjust tests where needed in `publishMessage` and `mtw-interfaces` suites for coverage of this flow.

- [ ] Phase 4 - regression and docs closeout
  - [ ] Run targeted actions/parser/publish/interface tests and capture pass commands in Verification.
  - [ ] Run lint diagnostics on edited files and resolve introduced issues.
  - [ ] Update this task plan checkboxes to reflect completed work.
  - [ ] If any steady-state behavior changed, update durable docs under `lambda/ephemera/dataSource/actions/`.

## Verification

Run from [`lambda/ephemera/`](../../../../../lambda/ephemera):

- `npm run test -- --runInBand dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts`
- `npm run test -- --runInBand publishMessage/index.test.ts`
- `npm run build`

Run from repo root as needed:

- `npx jest packages/mtw-interfaces/ts/messages.test.ts packages/mtw-interfaces/ts/ephemera.test.ts`
- relevant client message tests under `charcoal-client/src/components/Message/`

Record any additional commands actually used while implementing the task.

Phase 1 verification completed with:

- `cd /Users/anthonylower-basch/Code/maketheworld && npx jest --config lambda/ephemera/jest.config.js --runInBand lambda/ephemera/dataSource/actions/parseCommand.test.ts lambda/ephemera/dataSource/actions/parseCommandIntentClassification.test.ts`
- `cd /Users/anthonylower-basch/Code/maketheworld/lambda/ephemera && npm run build`
- `ReadLints` clean on edited files.

Phase 2 verification completed with:

- `cd /Users/anthonylower-basch/Code/maketheworld && npx jest --config lambda/ephemera/jest.config.js --runInBand lambda/ephemera/dataSource/actions/index.test.ts`
- `ReadLints` clean on edited files (`lambda/ephemera/dataSource/actions/index.ts`, `lambda/ephemera/dataSource/actions/index.test.ts`).

Phase 3 verification completed with:

- `cd /Users/anthonylower-basch/Code/maketheworld && npx jest --config lambda/ephemera/jest.config.js --runInBand lambda/ephemera/publishMessage/index.test.ts`
- `cd /Users/anthonylower-basch/Code/maketheworld && npx jest --config packages/mtw-interfaces/jest.config.js packages/mtw-interfaces/ts/messages.test.ts packages/mtw-interfaces/ts/ephemera.test.ts`
- `cd /Users/anthonylower-basch/Code/maketheworld/lambda/ephemera && npm run build`
- `ReadLints` clean on edited files (`lambda/ephemera/publishMessage/index.test.ts`, `packages/mtw-interfaces/ts/messages.test.ts`, `packages/mtw-interfaces/ts/ephemera.test.ts`).

## Progress

| Milestone | Status |
| --- | --- |
| Planning document created with scope and order | Done |
| Parser/result contract for help affordance | Done |
| Actions handler publish branch for `CoyoteGameHelpMessage` | Done |
| Publish/wire verification and tests | Done |
| Final docs/verification/checklist closeout | Not started |

## Notes and open decisions

- Help intent should support both deterministic command forms and Step A classification for natural-language requests with no slot extraction.
- If both deterministic and Step A paths are supported, deterministic path should run first to avoid unnecessary Bedrock calls.
- Keep this plan focused on process and sequencing; move lasting implementation guidance to durable `AGENT.md` docs if behavior changes permanently.
