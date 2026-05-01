# Coyote Game: affordancesProvided threading (planning)

**Status:** In progress. Phase A1 (mtw-interfaces contract + validator lock) landed; next step is Phase A2 (Acme enrich authoring + actions acceptance).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Track a task-scoped rollout for a new optional trope-affinity field:

- `affordancesProvided?: { object: string; intended?: true; roles: CoyoteTrope[] }[]`

This initiative adds explicit "provided affordance" signal in parallel to `environmentAffordances`, then threads that signal from Acme enrich through room-object persistence and hypothesis candidate generation into `planSelect`.

Per task assumptions for this plan:

- `affordancesProvided` is authored during Acme enrich (parallel to `environmentAffordances`).
- It is serialized/deserialized with room-object data.
- It must flow through candidate creation and into `planSelect`.
- It does not need to flow past `planSelect` in this slice; future iteration will use it to refine winner assembly and explicit affordance-object handling in `selectedCandidate`.

This file is task-scoped and should be archived or removed when this change is complete and durable behavior docs are updated in package-level `AGENT.md` files.

## Scope and boundaries

### In scope

- Extend trope-affinity interfaces/validators for `affordancesProvided`.
- Update Acme enrich prompt contract/examples so model output can include `affordancesProvided`.
- Preserve and validate field through actions publish contracts and object persistence.
- Preserve field in staged-object snapshot JSON used by hypothesis stage one.
- Thread field into candidate/planSelect boundary data so `planSelect` receives it in this architecture slice.
- Add and update tests for all touched boundaries.

### Out of scope

- Designing full "affordance object" semantics in `selectedCandidate` output.
- Consuming `affordancesProvided` in phase-plan or outcome steps.
- Any broader rubric redesign unrelated to this field-threading slice.

## Key code anchors

| Concern | Location |
| --- | --- |
| Trope affinity type guards and contracts | [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) |
| Meta room object typing | [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) |
| Acme enrich prompt schema | [`lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts`](../../../../../../lambda/ephemera/dataSource/actions/enrich/acmeOrder/buildPrompt.ts) |
| Action payload validation | [`lambda/ephemera/dataSource/actions/publishedEvents.ts`](../../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) |
| Order -> room object persistence/filtering | [`lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts`](../../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) |
| Stage-one object snapshot JSON | [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts) |
| Candidate combine and planSelect JSON input | [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) |
| PlanSelect handoff parser | [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) |
| Hypothesis pipeline docs | [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) |

## Locked design decisions

The following decisions are explicitly locked for this task.

- `affordancesProvided.object` is free text throughout this task (no closed-world restriction).
- `affordancesProvided.intended` is optional and, when present, must be literal `true`.
- `roles` uses existing `CoyoteTrope[]` allowlist and requires at least one role.
- `environmentAffordances` and `affordancesProvided` can coexist on the same trope entry.
- Room filtering rules currently apply only to `environmentAffordances`; `affordancesProvided` is pass-through in this slice unless implementation constraints force a narrower rule.
- Threading target is "up to and including `planSelect` inputs/handoff contracts"; no required downstream consumption in phase-plan/outcome for this task.

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read Coyote package/testing authority before commands: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If command examples conflict elsewhere, follow this file for lambda-level Jest usage.
3. Read current hypothesis pipeline contract notes: [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).
4. Read current trope-affinity validators and object contracts:
   - [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)
   - [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)
5. Confirm command context in package scripts:
   - [`lambda/ephemera/package.json`](../../../../../../lambda/ephemera/package.json)
   - [`package.json`](../../../../../../package.json)
6. Run one baseline verification command before edits (from `lambda/ephemera/`):
   - `npm run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts`

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase A1 - contract and validation lock
  - [X] Add `affordancesProvided` types and validators in `mtw-interfaces` with explicit strictness for `intended?: true`, free-text `object`, and trope-role allowlist.
  - [X] Extend `isCoyoteTropeAffinity` and related line-level validators to accept the new field and reject malformed rows.
  - [X] Add unit coverage for valid/invalid `affordancesProvided` payloads (including malformed `intended`, empty `roles`, and non-string `object`).

- [X] Phase A2 - Acme enrich authoring and action contracts
  - [X] Update Acme enrich prompt/schema docs and examples to emit `affordancesProvided` alongside `environmentAffordances` where appropriate.
  - [X] Ensure publish payload validation accepts structured `affordancesProvided` via `CoyoteTropeAffinity` validators.
  - [X] Add tests in actions package for acceptance/rejection behavior and mixed affordance-field payloads.

- [ ] Phase A3 - persistence and snapshot threading
  - [ ] Confirm order-to-room-object persistence carries `affordancesProvided` unchanged.
  - [ ] Keep existing room filtering behavior for `environmentAffordances`; do not drop `affordancesProvided` unless explicitly required.
  - [ ] Add regression tests around `handleApiObjectsChange` and snapshot serialization to verify round-trip persistence.

- [ ] Phase A4 - hypothesis flow-through to planSelect
  - [ ] Preserve `affordancesProvided` in stage-one snapshot consumption used by candidate creation.
  - [ ] Extend candidate-combine -> planSelect input JSON shape so planSelect sees `affordancesProvided` signal at member/object level consistent with current architecture.
  - [ ] Update prompt contract wording in candidate/planSelect builders so the field is described as available evidence.
  - [ ] Update parser/types at planSelect boundary as needed so handoff data remains schema-consistent and testable.

- [ ] Phase A5 - tests, docs, and closeout
  - [ ] Update focused hypothesis tests (`serializeStagedObjects*`, `combineCandidateOutput*`, `buildPlanSelectPrompt*`, and parser tests) for the new field.
  - [ ] Update durable package docs (`coyoteGame/AGENT.md` and `hypothesis/AGENT.md`) for steady-state behavior after merge.
  - [ ] Update this plan checkboxes/progress and archive/remove this file when task is complete per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

Baseline:

```bash
npm run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts
```

Actions + object persistence:

```bash
npm run test -- --watchAll=false dataSource/actions/parseCommand.test.ts
npm run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts
npm run test -- --watchAll=false dataSource/objects/handleApiObjectsChange.test.ts
```

Hypothesis pipeline slice:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.test.ts
```

Broader confidence (as needed):

```bash
npx jest dataSource/coyoteGame/ dataSource/actions/ dataSource/objects/
```

## Progress

| Milestone | Status |
| --- | --- |
| Plan drafted with assumptions and boundaries | Done |
| A1 contract + validator lock | Done |
| A2 Acme enrich + actions acceptance | Done |
| A3 persistence + snapshot threading | Not started |
| A4 candidate -> planSelect flow-through | Not started |
| A5 docs/tests closeout | Not started |
