# Multiple Command Parse Plan

**Status:** In progress. Phase 2 is shipped; next step is Phase 3 parse pipeline and runtime handling for `MultipleCommands`.

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

- [X] Phase 1 - lock contract and wording
  - [X] Finalized model output shape for multiple-command detection: `type: "MultipleCommands"` with required `confidence`.
  - [X] Use a dedicated parse result for this condition (not generic `Error`), and document the invariant in `baseClasses.ts` comments.
  - [X] Player-facing message copy: "That looks like trying to do more than one thing in a single command. Please only try to do one thing at a time." Define and use a dedicated internal error constant for this outcome.

- [X] Phase 2 - prompt and interpreter
  - [X] Update intent prompt decision order and tie-break rules to prioritize multi-action detection before normal intent selection.
  - [X] Add explicit positive/negative examples including:
    - [X] `order explosives and bandages` (single Acme order, valid)
    - [X] `order explosives and then order bandages` (multiple commands)
    - [X] `go east, after which wait` (multiple commands)
  - [X] Update `interpretIntentClassificationBody` accepted shapes and invalid-shape errors accordingly.
  - [X] Extend `intentClassification` tests for accepted/rejected payloads and error text.

- [ ] Phase 3 - parse pipeline and runtime handling
  - [ ] Propagate the new outcome through parse unions/type guards and `discriminateIntent` return type flow.
  - [ ] Ensure `parseCommand` routing keeps Acme Step B disabled for multi-command outcomes so Step B only receives single-command Acme input.
  - [ ] Simplify Acme Step B by removing now-unneeded multi-verb-phrase handling paths and any guardrails that existed only to prevent those paths from misfiring.
  - [ ] Confirm Step B contract/comments/tests now explicitly assume one verb-phrase and item-list shaping only.
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
| Contract decision (`MultipleCommands` representation and copy) | Done |
| Prompt + interpreter updates | Done |
| Parse pipeline + DataSource runtime updates | Not started |
| Tests + build verification | In progress |
| Durable docs sync and plan retirement | Not started |

