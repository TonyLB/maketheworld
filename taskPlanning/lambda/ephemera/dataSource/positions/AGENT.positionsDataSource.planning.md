# Positions DataSource Planning (`mtw.ephemera.positions`)

**Status:** In progress. Initial planning only; next step is to align the first implementation slice that brings `RoomCharacter` ownership and `moveCharacter` execution into a dedicated positions DataSource.

## Purpose

Create a task-scoped plan for introducing `mtw.ephemera.positions` as the movement and location authority, starting with character-room positioning responsibilities now spread across legacy handlers.

This plan is task-scoped and should be removed or archived after the positions initiative is complete.

## Scope and boundaries

### In scope for initial slice

- Define the first `mtw.ephemera.positions` DataSource boundary and ingress/egress event contracts.
- Plan migration of character-room placement concerns (`RoomCharacter` information) into positions-owned flows.
- Plan migration of imperative movement execution currently handled by `moveCharacter`.
- Preserve behavior parity while ownership transitions (bridge patterns are acceptable during migration).

### Explicitly out of scope for this initial plan

- Full object-position modeling in rooms.
- Relative-position systems (object-to-object or character-to-object spatial relationships).
- Rich spatial reasoning design (distance, orientation, layout constraints, collision, etc.).
- Final long-term architecture docs (those belong in durable `AGENT.md` files once implementation stabilizes).

## Getting started

Follow the root complex-task pattern and gather context from current movement ownership points:

1. Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. Root workflow pattern: [`AGENT.md` "Getting Started pattern for complex tasks"](../../../../../../AGENT.md#getting-started-pattern-for-complex-tasks)
3. DataSource index and conventions: [`lambda/ephemera/dataSource/AGENT.md`](../../../../../../lambda/ephemera/dataSource/AGENT.md)
4. Current actions movement contract source: [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.md)
5. Current imperative movement execution baseline:
   - [`lambda/ephemera/moveCharacter/index.ts`](../../../../../../lambda/ephemera/moveCharacter/index.ts)
   - [`lambda/ephemera/parse/executeAction.ts`](../../../../../../lambda/ephemera/parse/executeAction.ts)
6. Movement affordance durable outcomes:
   - [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.md)
   - [`lambda/ephemera/dataSource/AGENT.md`](../../../../../../lambda/ephemera/dataSource/AGENT.md)

## Current observations to anchor design

- `mtw.ephemera.actions` now emits `Character Navigate` and also bridges to imperative `MoveCharacter` for parity.
- `moveCharacter` currently owns transactional room membership changes and related side effects (room updates, map updates, perception orchestration hooks).
- There is no `mtw.ephemera.positions` DataSource yet; ownership boundaries are still split across legacy handlers and actions-adjacent flows.

## Key design questions (to resolve before implementation)

- What concrete subscribed event(s) should `mtw.ephemera.positions` own first (`Character Navigate`, `MoveCharacter`, or a new positions command envelope)?
- Which side effects remain inside positions versus delegated to sibling systems (perception orchestration, map updates, room header refreshes)?
- What migration sequence minimizes risk while avoiding long-lived dual ownership?
- Which contracts should be considered temporary bridge contracts versus durable positions contracts?

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step lands.

- [ ] Phase 1 - boundary and ownership definition
  - [ ] Define first-slice positions ownership goals (`RoomCharacter` plus movement execution authority).
  - [ ] Define non-goals and explicit deferrals for object/relative positioning capabilities.
  - [ ] Record bridge-period constraints and parity requirements.

- [ ] Phase 2 - contract and wiring plan
  - [ ] Identify ingress message/event shape(s) for positions.
  - [ ] Define outbound/state update contracts for downstream consumers.
  - [ ] Map old ownership points to new positions-owned responsibilities.

- [ ] Phase 3 - implementation slices
  - [ ] Create positions DataSource skeleton and subscribe/wire first ingress path.
  - [ ] Migrate `RoomCharacter` update ownership into positions flow.
  - [ ] Migrate `moveCharacter` handler responsibilities into positions-owned execution path.
  - [ ] Add compatibility bridge behavior where needed during transition.

- [ ] Phase 4 - verification and cutover notes
  - [ ] Add targeted tests for positions-owned movement and room-character updates.
  - [ ] Run parity checks against existing movement user-visible behavior.
  - [ ] Update durable docs and retire bridge notes after cutover is complete.

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

- Movement and actions baseline:
  - `npx jest --config "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera/jest.config.js" --runInBand dataSource/actions/index.test.ts dataSource/actions/parseCommand.test.ts`
- Movement executor baseline:
  - `npx jest --config "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera/jest.config.js" --runInBand moveCharacter/index.test.ts`
- Positions tests:
  - Add concrete commands here when first `positions` package tests exist.

## Progress

| Milestone | Status |
| --- | --- |
| Create positions task plan | Done |
| Define first-slice ownership and boundaries | Not started |
| Draft positions contracts and migration sequence | Not started |
| Implement first positions-owned movement slice | Not started |
| Document durable cutover outcomes | Not started |
