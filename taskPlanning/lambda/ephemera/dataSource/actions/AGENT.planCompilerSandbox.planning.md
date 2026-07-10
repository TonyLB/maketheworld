# Plan-compiler dry-run sandbox (Phase C prerequisite)

**Status:** Not started. Split out of [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) (2026-07-10) --- that plan's Phase C design debt named this as a prerequisite for C1 but carried no `Recommended order` of its own. This sibling plan owns just the sandbox: design debt consolidation, open decisions, and a build checklist.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

**Parent / sibling relationship:** [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) owns Phase C's Plan IR, compiler, and executor work generally (C1--C5). This plan owns only the **dry-run legality sandbox** the C1 compiler/validator consumes. Land this plan's C1 items alongside (or just ahead of) the parent's C1 checklist --- the parent's compiler cannot emit a validated candidate without this sandbox existing.

## Purpose

Phase B shipped two **single-step** dry-run validators --- [`validatePlanDryRun.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/validatePlanDryRun.ts): `validateMembershipPlanDryRun` (FT-2.2) and `validateRelationalPlanDryRun` (FT-3.3). Both evaluate one candidate plan against **current** graph/catalog state; neither simulates a hypothetical post-step state. Their membership docstring says outright "No compound sandbox."

Phase C composition (BD-8: auto-insert `drop` before `establishRelation`; BD-9: atomic multi-step apply) needs a validator that can tell whether a **compound** plan is legal **before** any real `transactWrite` --- which requires simulating the intermediate state a compound plan passes through (e.g. after the simulated `drop`, is the object now eligible for `establishRelation`?). That simulator is this sandbox.

## Scope

### In scope

- A pure evaluator: `(proposedPlan, currentState) -> { verdict, decidable, resultPreview }`. No persist, no Dynamo reads --- hydrates from **ingress-packaged context** (room + held catalogs/graph) already assembled for the command.
- **Compound simulation:** apply step 1 of a plan to an in-memory copy of state, then evaluate step 2 against the mutated copy (not the original). Reuses the existing single-step validators as the per-step primitive.
- **Deterministic interaction-under-transfer semantics per enum relation** (the modeled core that makes enum fast-approve legitimate): e.g. `On` dissolves freely on pickup; `Under` may block or require composition before a transfer is legal. `Custom` / unmodeled blast radius has no such core and routes to the LLM validator (BD-10 `defer`) instead of the sandbox.
- `resultPreview` shape sufficient for C2's single composed transcript (not separate drop + relate lines) and for Consult-menu presentation of runner-up legal candidates (FT-5).
- Wiring into the C1 compiler/selector: enum -> sandbox fast-approve; `Custom` / unmodeled -> LLM validator tier.

### Out of scope (unless plan updated)

- Re-deriving the single-step legality rules themselves (`validateMembershipPlanDryRun`, `validateRelationalPlanDryRun`, `evaluateRelationalLegality`) --- those are shipped; this plan composes them, not rewrites them.
- The LLM joint `(identity, plan)` proposer that generates candidates for the sandbox to evaluate --- that's parent-plan C1 scope.
- Persist / apply --- the kernel `transactWrite` bundling (BD-9) is a positions-layer concern once a plan is selected; the sandbox only decides legality, never writes.

## Background (durable docs / shipped code --- link, do not duplicate)

| Topic | Doc / file |
| --- | --- |
| Single-step dry-run validators (shipped, FT-2.2 / FT-3.3) | [`validatePlanDryRun.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/validatePlanDryRun.ts) |
| Relational legality rules | [`evaluateRelationalLegality.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.ts) |
| Selector / candidate types | [`identityPlanCandidate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/identityPlanCandidate.ts) |
| Trust posture, seam rules | [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) |
| Positions kernel bundling (`applyHostEffects`, atomic apply target) | [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) |

## Design debt (carried over from fault-tolerant gateway retirement, 2026-07-10)

Moved verbatim from the parent plan's "Phase C design debt --- Instruction compiler + validator (C1/C2)" section. Graduate into durable docs (`objectManipulation/AGENT.md`, positions contract) when this plan's C1 items ship.

**Propose-N, then deterministic legality-gated selection (not iterative backtrack).** The joint hop emits N ranked `(identity, plan)` candidates in one generation; a deterministic selector evaluates all N and picks-or-Consults. Selection is a testable pure function of `(candidates, current-state)`.

- **Legality gates, confidence ranks --- lexicographic.** Partition by legality (`clean-legal` > `defer` > `illegal`); rank within legal survivors by absolute calibrated confidence. Confidence never buys back illegality.
- **Selection may decline.** Below FT-5 floor or thin margin over runner-up -> Consult/Abstain, not argmax. Runner-up legal candidates are the Consult menu.
- **Dry-run over an in-memory sandbox.** Pure `(proposedPlan, currentState) -> { verdict, decidable, resultPreview }` without persist. Compound (BD-9) plans need simulated intermediate state (drop then relate). Sandbox hydrates from ingress-packaged context (room + held catalogs/graph), not fresh Dynamo reads.
- **Validator tiers on enum vs `Custom` (= BD-10 `defer`).** Enum relations (`On`/`Under`/`Against`) -> deterministic fast-approve. `Custom` / unmodeled blast radius -> LLM validator (Phase D escalation).
- **Staged fast-path composition.** Pipeline stages are decision points with closed-world fast-path + LLM fallback. Bedrock cost = number of stages whose closed-world predicate fails. Golden path (exact label + known verb + all-enum) stays zero Bedrock.
- **Keep proposer/validator split** even when both are deterministic on the golden path --- the validator is the single shared legality authority the LLM proposer must also pass.
- **Enum relations need deterministic interaction-under-transfer semantics** (this plan): e.g. `On` dissolves freely on pickup; `Under` may block or require composition. That modeled core is what makes enum fast-approve legitimate --- and what `Custom` lacks.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement this sandbox. When a decision ships, record it in `objectManipulation/AGENT.md` / positions contract and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| SB-1 | **Multi-host scope** --- does the sandbox need to simulate a compound plan that spans **more than one `positionGraph`** in v1, or does BD-6 (host always = actor's current room) mean every Phase C compound plan is single-host, and cross-host simulation is deferred to the future nesting/container operator? | Sandbox state shape | Open |
| SB-2 | **Interaction-under-transfer rule table location** --- new module (e.g. `interactionUnderTransfer.ts`) consumed by both the sandbox and `evaluateRelationalLegality`, vs inlined into the sandbox evaluator directly. | Sandbox build order | Open |
| SB-3 | **`resultPreview` contents** --- minimum fields C2 (single composed transcript) and FT-5 (Consult menu rendering of runner-up candidates) actually need; avoid over-fitting to one consumer before both exist. | Sandbox evaluator signature | Open |
| SB-4 | **In-memory state representation** --- clone-and-mutate a typed snapshot of the ingress-packaged catalogs/graph vs a diff/patch-list applied lazily at read time. Affects perf and how naturally per-step primitives compose. | Compound simulation step | Open |

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read the shipped single-step validators: [`validatePlanDryRun.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/validatePlanDryRun.ts) and [`evaluateRelationalLegality.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/evaluateRelationalLegality.ts) --- these are the per-step primitives the sandbox composes, not rewrites.
3. Read the parent plan's Phase C section for how the sandbox fits the compiler/selector: [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) (Phase C in-scope, C1/C2 checklist, "Phase C design debt").
4. Read BD-8 / BD-9 in the parent plan's Open decisions table --- the composition + atomic-apply rules this sandbox must validate against before the kernel ever runs a real `transactWrite`.
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
6. Baseline (existing single-step validator + relational compiler tests):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [ ] **S1. Resolve open decisions (SB-1 -- SB-4)**
  - [ ] Confirm multi-host scope for v1 (SB-1) against BD-6 host-selection rule in the parent plan.
  - [ ] Decide interaction-under-transfer rule table location (SB-2).
  - [ ] Decide `resultPreview` minimum shape (SB-3).
  - [ ] Decide in-memory state representation (SB-4).

- [ ] **S2. Sandbox state + single-step composition**
  - [ ] Define `SandboxState` type (hydrated from ingress-packaged room/held catalogs + host `positionGraph`(s) per SB-1).
  - [ ] Wrap `validateMembershipPlanDryRun` / `validateRelationalPlanDryRun` as the sandbox's per-step primitive, unchanged in behavior.
  - [ ] Tests: sandbox single-step parity with existing dry-run validator tests (no behavior drift).

- [ ] **S3. Interaction-under-transfer rule table**
  - [ ] Build the deterministic per-enum-relation rule set (`On` dissolves on pickup; `Under` may block/compose; etc.).
  - [ ] Wire into the compound simulation step (S4) so a simulated `drop` correctly updates/removes relational edges before the next step evaluates.
  - [ ] Tests: each enum relation's transfer behavior; `Custom` explicitly excluded (routes to LLM validator, not this table).

- [ ] **S4. Compound simulation**
  - [ ] Implement the mutate-and-reevaluate loop: apply step N's effect to the in-memory state (per SB-4 representation), then evaluate step N+1 against the mutated state.
  - [ ] Enforce BD-9 semantics in the simulation itself: if any step is illegal/deferred, the whole plan reports as such (no partial-legal plans).
  - [ ] Tests: held object + surface relation composed plan (BD-8 golden path); a case where the interaction rule blocks composition (e.g. `Under` conflict).

- [ ] **S5. `resultPreview` + wiring**
  - [ ] Implement `resultPreview` per SB-3 decision.
  - [ ] Wire sandbox output into the C1 selector: enum -> sandbox fast-approve tier; `Custom` / unmodeled -> LLM validator tier (BD-10 `defer`).
  - [ ] Tests: end-to-end candidate -> sandbox verdict -> selector outcome, including a Consult case surfacing runner-up legal candidates from `resultPreview`.

- [ ] **S6. Durable docs**
  - [ ] Graduate shipped behavior into [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) and/or [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) as applicable.
  - [ ] Remove resolved rows from **Open decisions** above.
  - [ ] Delete this planning file once C1 (parent plan) consumes the sandbox and Phase C steady-state docs land; git retains history.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/

npm run build
```

## Progress

| Milestone | Status |
| --- | --- |
| Split from parent plan's Phase C design debt | Done (2026-07-10) |
| SB-1 -- SB-4 open decisions | Not started |
| S2 sandbox state + single-step composition | Not started |
| S3 interaction-under-transfer rule table | Not started |
| S4 compound simulation | Not started |
| S5 resultPreview + wiring | Not started |
| S6 durable docs | Not started |
