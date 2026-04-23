# Feature and Knowledge `examples` migration (follow-up)

Status: not started. Room-only **`StandardRoom.examples`** removal is **complete**; steady-state Room vs Feature/Knowledge behavior is documented in [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md) and linked package **`AGENT.md`** files (see **Durable context** below). This plan tracks **follow-up** work where **`StandardFeature`** and **`StandardKnowledge`** still use **`examples`** reference lists.

## Purpose and scope

Track investigation and migration of runtime (and related test/docs) dependencies where `StandardFeature` and `StandardKnowledge` still rely on `examples` reference lists and first-example display paths. This is separate from the Room situation/render migration; it should proceed when Feature/Knowledge authoring and ephemera contracts are ready to move off examples.

This file is task-scoped and temporary. See [`taskPlanning/AGENT.md`](../../../AGENT.md) for task-plan conventions.

## Durable context (Room initiative complete)

- WML model: [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md) (**CRITICAL (Feature and Knowledge)**, **Room vs nested Example**).
- Assets **`mtw.assets.componentExamples`** (Feature/Knowledge-only parent discovery at filter): [`lambda/assets/componentExamples/AGENT.md`](../../../../lambda/assets/componentExamples/AGENT.md).
- Ephemera **`ExamplesData`**: [`lambda/ephemera/internalCache/examples.AGENT.md`](../../../../lambda/ephemera/internalCache/examples.AGENT.md).

## Defer call sites (Feature/Knowledge `examples`; unchanged during Room-only work)

| Call site | Role today |
| --- | --- |
| [`charcoal-client/src/components/Message/ComponentDescription.tsx`](../../../../charcoal-client/src/components/Message/ComponentDescription.tsx) | Feature/Knowledge display text from first linked **`StandardExample`** via **`component.examples.payload[0]`** |
| [`charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.ts) | Example membership and sibling layering for Feature/Knowledge only (**`parent.examples`**); Room path uses Situation/Guidance |

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md).
2. Read orientation for WML standardization: [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md).
3. Review **Defer call sites** above and **Durable context** links.

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
  - [ ] Confirm current behavior at **Defer call sites** (section above).
  - [ ] Capture test-only and documentation references.
- [ ] Draft migration strategies per call site (replace vs defer with rationale).
- [ ] Execute slices with tests and inventory re-baseline (details TBD when work starts).
