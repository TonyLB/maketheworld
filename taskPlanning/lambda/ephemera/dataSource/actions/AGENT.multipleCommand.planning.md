# Multiple Command Parse Plan

**Status:** In progress. Next step is to define and land the `MultipleCommands` intent-classification contract, then wire player-facing error handling.

## Purpose

Add explicit parser support for "multiple commands on one line" so mixed-action inputs do not silently collapse to one intent. This task should make multi-action requests return one unambiguous parse outcome, while preserving valid single-intent multi-item Acme orders.

Examples:

- Reject: `go east then wait for the road runner`
- Reject: `order explosives then look around`
- Reject: `order explosives and then order bandages`
- Allow: `order explosives and bandages`

This is task-scoped and should be deleted after the slice is fully shipped and durable docs are updated.

## Getting started

Follow the root getting-started pattern for complex tasks and keep this plan focused on task process, not long-lived architecture docs.

1. **Read planning conventions first**
   - Why: This file must follow task-plan durability and checkbox conventions.
   - Read: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

2. **Read area foundations**
   - Why: Understand parse pipeline boundaries and where intent discrimination stops vs Acme Step B starts.
   - Read: [`AGENT.actionParse.plan.md`](./AGENT.actionParse.plan.md), [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md), [`lambda/ephemera/dataSource/actions/enrich/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/AGENT.md).

3. **Review code touchpoints**
   - Why: This change crosses prompt design, interpretation, type contracts, parse orchestration, and handler response copy.
   - Read:
     - [`lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/buildIntentClassificationPrompt.ts)
     - [`lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.ts)
     - [`lambda/ephemera/dataSource/actions/discriminateIntent/index.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/index.ts)
     - [`lambda/ephemera/dataSource/actions/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts)
     - [`lambda/ephemera/dataSource/actions/parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts)
     - [`lambda/ephemera/dataSource/actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts)

4. **Review tests before edits**
   - Why: Establish current behavior and extend existing test style.
   - Read:
     - [`lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.test.ts`](../../../../../lambda/ephemera/dataSource/actions/discriminateIntent/intentClassification.test.ts)
     - [`lambda/ephemera/dataSource/actions/parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts)
     - [`lambda/ephemera/dataSource/actions/index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts)

## Scope

### In scope

- Add a new intent-classification outcome for multiple commands in a single user input line.
- Encode disambiguation rules in the `discriminateIntent` prompt so "multi-action" and "single action + multiple items" are separated.
- Add parse/intent type support and guards for the new outcome.
- Ensure parser/handler produce stable user-visible error behavior for this condition.
- Add test coverage for prompt contract, interpreter acceptance/rejection, parse flow, and DataSource response behavior.

### Out of scope

- General natural-language decomposition into executable command queues.
- Expanding action execution to support chained commands.
- Reworking Acme Step B item segmentation logic beyond what is needed to preserve current valid behavior.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested items `[X]` as they are finished.

- [ ] Phase 1 - lock contract and wording
  - [ ] Choose final model output shape for multiple-command detection (for example `type: "MultipleCommands"` with `confidence`).
  - [ ] Decide whether this is represented as a dedicated parse result vs `Error` with canonical code/message, then document the invariant in `baseClasses.ts` comments.
  - [ ] Define player-facing message copy and internal error constant strategy.

- [ ] Phase 2 - prompt and interpreter
  - [ ] Update intent prompt decision order and tie-break rules to prioritize multi-action detection before normal intent selection.
  - [ ] Add explicit positive/negative examples including:
    - [ ] `order explosives and bandages` (single Acme order, valid)
    - [ ] `order explosives and then order bandages` (multiple commands)
    - [ ] `go east, after which wait` (multiple commands)
  - [ ] Update `interpretIntentClassificationBody` accepted shapes and invalid-shape errors accordingly.
  - [ ] Extend `intentClassification` tests for accepted/rejected payloads and error text.

- [ ] Phase 3 - parse pipeline and runtime handling
  - [ ] Propagate the new outcome through parse unions/type guards and `discriminateIntent` return type flow.
  - [ ] Ensure `parseCommand` routing keeps Acme Step B disabled for multi-command outcomes.
  - [ ] Add/adjust actions DataSource handling so players get deterministic user-facing feedback for multi-command inputs.
  - [ ] Preserve existing behavior for all current non-multi-command outcomes.

- [ ] Phase 4 - verification and doc hygiene
  - [ ] Add regression tests for mixed-intent strings and Acme item-list edge cases.
  - [ ] Run targeted tests and ephemera build.
  - [ ] Update this plan checkboxes and progress table to reflect shipped work.
  - [ ] If any behavior contracts become long-lived, move them to durable `AGENT.md` docs and keep only task-specific process notes here.

## Verification

Run from `lambda/ephemera`:

- `npm run test -- --runInBand dataSource/actions/discriminateIntent/intentClassification.test.ts`
- `npm run test -- --runInBand dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts`
- `npm run build`
- `ReadLints` on edited action parse files

Behavior checks to assert in tests:

- Multi-command phrasings map to the new dedicated multiple-command outcome and user-facing error path.
- Single-intent Acme multi-item phrasing (`order X and Y`) remains valid and does not regress.
- Acme Step B still runs only for `AcmeOrderIntent`, not for multi-command outcomes.

## Progress

| Milestone | Status |
| --- | --- |
| Plan created and scoped | Done |
| Contract decision (`MultipleCommands` representation and copy) | Not started |
| Prompt + interpreter updates | Not started |
| Parse pipeline + DataSource runtime updates | Not started |
| Tests + build verification | Not started |
| Durable docs sync and plan retirement | Not started |

