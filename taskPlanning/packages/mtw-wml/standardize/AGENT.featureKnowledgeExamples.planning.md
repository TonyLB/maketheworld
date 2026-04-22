# Feature and Knowledge `examples` migration (follow-up)

Status: not started. This plan is a placeholder spun out from [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) so out-of-scope Feature/Knowledge `examples` work has an explicit home after Room-only `StandardRoom.examples` dependency removal.

## Purpose and scope

Track investigation and migration of runtime (and related test/docs) dependencies where `StandardFeature` and `StandardKnowledge` still rely on `examples` reference lists and first-example display paths. This is separate from the Room situation/render migration; it should proceed when Feature/Knowledge authoring and ephemera contracts are ready to move off examples.

This file is task-scoped and temporary. See [`taskPlanning/AGENT.md`](../../../AGENT.md) for task-plan conventions.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md).
2. Read orientation for WML standardization: [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md).
3. Re-open the Room plan defer registry in [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) (section **Out-of-scope Feature/Knowledge defer registry**) for the initial call-site list.

## Owner placeholders

- `TBD(feature-knowledge-followup)` - assign an owner when this initiative is scheduled.

## Progress

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| 1 | Inventory Feature/Knowledge `examples` footprint | Pending | Runtime, tests, docs |
| 2 | Classify and sequence migrations | Pending | |
| 3 | Implement and verify | Pending | |

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

- [ ] Inventory Feature/Knowledge `examples` runtime footprint (non-test, non-doc).
  - [ ] Confirm current behavior at defer sites called out from the Room plan (see defer registry there).
  - [ ] Capture test-only and documentation references.
- [ ] Draft migration strategies per call site (replace vs defer with rationale).
- [ ] Execute slices with tests and inventory re-baseline (details TBD when work starts).
