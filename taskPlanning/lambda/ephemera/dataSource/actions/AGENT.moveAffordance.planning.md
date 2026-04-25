# Move Affordance Planning (`mtw.ephemera.actions`)

**Status:** In progress. Scoped to movement affordance parsing plus event emission and imperative execution parity (`event + imperative`) in `mtw.ephemera.actions`; eventual subscriber cutover is deferred to a later `mtw.ephemera.positions` initiative.

## Purpose

Coordinate and refine the work to extend command parsing with character movement affordances in the `mtw.ephemera.actions` pipeline, while preserving current behavior through an explicit `event + imperative` bridge.

This task plan is task-scoped and should be deleted or archived after the movement affordance initiative is complete.

## Scope and boundaries

### In scope for this plan

- Define and ship movement affordance parsing in `actions` parse flow.
- Prefer deterministic parsing for obvious exit commands (for example `east`, `go east`) when exits are known.
- Decide and document how Step A prompt context should include exits and target room short names.
- Add or refine stream contracts for movement events consumed by downstream systems.
- Preserve present user-visible movement behavior by pairing stream emission with imperative movement execution in this task.

### Out of scope for this plan

- Broad redesign of all parse intents.
- Non-movement affordance expansions.
- Defining or implementing `mtw.ephemera.positions` (including subscriber-based movement ownership).
- Long-term steady-state architecture docs (those belong in code-adjacent `AGENT.md` files and should be linked from here).

## Getting started

Follow the root getting-started pattern and skim the task-planning rules before implementation:

1. Task-planning conventions: [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. Root workflow pattern: [`AGENT.md` "Getting Started pattern for complex tasks"](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks)
3. DataSource index: [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md)
4. Actions package guide: [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md)
5. Existing parse implementation and contract:
   - [`lambda/ephemera/dataSource/actions/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts)
   - [`lambda/ephemera/dataSource/actions/parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts)
   - [`lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts)
   - [`lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts)
   - [`lambda/ephemera/dataSource/actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts)
   - [`lambda/ephemera/dataSource/actions/publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)
6. Legacy movement parsing and imperative movement baseline:
   - [`lambda/ephemera/parse/index.ts`](../../../../../lambda/ephemera/parse/index.ts)
   - [`lambda/ephemera/parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts)
   - [`lambda/ephemera/moveCharacter/index.ts`](../../../../../lambda/ephemera/moveCharacter/index.ts)

## Current observations to anchor design

- `actions` already emits `Character Navigate` when parse returns `Navigation` and target is a valid room exit.
- Current `actions` parse Step A prompt does not include movement intent labels yet.
- Legacy parse already has deterministic exit matching for `exact exit name` and `go <exit name>`.
- Imperative movement execution currently runs via message bus `MoveCharacter`, and no active DataSource subscriber for `Character Navigate` to execute movement was confirmed during initial review.

## Decisions locked for this task

- Use `event + imperative` movement handling for this task's implementation scope.
- Use deterministic-first movement parsing with Step A LLM fallback for natural-language movement phrasing.
- For LLM fallback, parse to an exit label/alias intent and resolve `toRoomId` server-side from current-room exits; do not trust model-provided room ids.
- Start Step A movement fallback context with exit names only; evaluate before adding destination room short names.
- Keep `Character Navigate` event emission in actions so downstream systems can subscribe later.
- Emit minimal movement event payload as `characterId`, `fromRoomId`, and `toRoomId` after exit validation/resolution.
- Do not add extra movement payload fields in this task; defer until concrete `mtw.ephemera.positions` requirements exist.
- Bridge to imperative movement execution now for behavioral parity and immediate functionality.
- Defer event-only subscriber cutover to a later task that defines `mtw.ephemera.positions` and subsumes imperative `moveCharacter` functionality.

Durable-doc linkage for this phase:

- Mirror these locked decisions in [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) when implementation lands.
- Keep `mtw.ephemera.positions` ownership/cutover details in the later positions task plan and final durable docs, not this task-scoped file.

## Key design questions to resolve

No open design questions remain for Phase 1.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step lands.

- [X] Phase 1 - contract and decision checkpoint
  - [X] Confirm movement intent boundary and fallback strategy (deterministic first, Step A LLM fallback for natural-language movement phrasing).
  - [X] Decide prompt context fields for movement (start with exit labels only; add destination short names later only if needed).
  - [X] Lock movement payload contract (`characterId`, `fromRoomId`, `toRoomId`) with server-side exit validation/resolution.
  - [X] Confirm no additional movement payload fields for this task (avoid overengineering until `mtw.ephemera.positions` requirements are concrete).
  - [X] Lock temporary dual-path behavior as event + imperative for this task.
  - [X] Record decisions in this plan and link lasting outcomes to durable docs.

- [ ] Phase 2 - deterministic movement parse branch
  - [ ] Add deterministic short-circuit parsing for direct exit commands in `parseCommand` pipeline.
  - [ ] Reuse room-exit context source in actions flow (single source of truth for available exits).
  - [ ] Keep behavior explicit for invalid exits and no-room cases.
  - [ ] Add focused unit tests for deterministic matching variants and edge cases.

- [ ] Phase 3 - optional Step A movement intent support
  - [ ] Extend Step A prompt/types/interpretation with movement intent label if Phase 1 selects LLM fallback.
  - [ ] Pass selected movement context (exits and destination short names) into prompt construction.
  - [ ] Ensure type guards and parse result union remain aligned.
  - [ ] Add tests covering model output validation and fallback behavior for movement intent.

- [ ] Phase 4 - actions handler and downstream execution
  - [ ] Ensure actions handler emits movement event contract needed by downstream systems.
  - [ ] Implement imperative movement execution bridge for parity in this task.
  - [ ] Add tests proving both event emission and imperative movement execution behavior.

- [ ] Phase 5 - handoff notes and docs
  - [ ] Document deferred cutover target (`mtw.ephemera.positions`) and explicit non-goals in durable docs.
  - [ ] Update durable docs in `lambda/ephemera/dataSource/actions/AGENT.md` and related package docs.
  - [ ] Mark this plan complete and remove/archive when no longer needed.

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

- Targeted parser and actions tests:
  - `npm run test -- --runInBand dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts`
- Movement path tests:
  - `npm run test -- --runInBand moveCharacter/index.test.ts`
- Build check:
  - `npm run build`
- Optional broader confidence sweep after substantial wiring:
  - `npm test`

## Progress

| Milestone | Status |
| --- | --- |
| Create movement affordance task plan | Done |
| Phase 1 contract decisions | Not started |
| Deterministic movement parse branch | Not started |
| Step A movement support (if selected) | Not started |
| Event plus imperative movement bridge | Not started |
| Handoff docs for later positions cutover | Not started |
