# Plan-compiler dry-run sandbox (Phase C prerequisite)

**Status:** **All build slices shipped (S1--S6, 2026-07-10 -- 2026-07-11).** S1--S5: rule table, multi-host state, single-step composition, compound sequencing, selector-readiness proof --- 61 suites / 426 tests, zero regressions. **S6 (2026-07-11):** durable docs graduated into [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) ("Phase C sandbox" section) --- this plan-only doc trimmed accordingly. **Not deleted yet, correctly:** this plan's own exit criterion (S6) is "once C1 consumes the sandbox," and C1 hasn't started --- see the parent plan for that work. Split out of [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) (2026-07-10) --- that plan's Phase C design debt named this as a prerequisite for C1 but carried no `Recommended order` of its own. This sibling plan owns just the sandbox: design debt consolidation, open decisions, and a build checklist.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

**Parent / sibling relationship:** [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) owns Phase C's Plan IR, compiler, and executor work generally (C1--C5). This plan owns only the **dry-run legality sandbox** the C1 compiler/validator consumes. Land this plan's C1 items alongside (or just ahead of) the parent's C1 checklist --- the parent's compiler cannot emit a validated candidate without this sandbox existing.

## Purpose

Phase B shipped two **single-step** dry-run validators --- [`validatePlanDryRun.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/validatePlanDryRun.ts): `validateMembershipPlanDryRun` (FT-2.2) and `validateRelationalPlanDryRun` (FT-3.3). Both evaluate one candidate plan against **current** graph/catalog state; neither simulates a hypothetical post-step state. Their membership docstring says outright "No compound sandbox."

Phase C composition (BD-8: auto-insert `drop` before `establishRelation`; BD-9: atomic multi-step apply) needs a validator that can tell whether a **compound** plan is legal **before** any real `transactWrite` --- which requires simulating the intermediate state a compound plan passes through (e.g. after the simulated `drop`, is the object now eligible for `establishRelation`?). That simulator is this sandbox.

**Not compound-only (corrected 2026-07-10):** the same question arises for an ordinary **length-1** `transferMembership` step with no relational step at all --- "pick up the tray" when a glass is `On` the tray must ask exactly the same interaction-under-transfer question (SB-5) as a BD-8 composed plan does, because the tray is the **target** of an existing relational edge. Today's shipped `validateMembershipPlanDryRun` has no mechanism for this --- it only checks exit edges (room connections), never relational edges. The sandbox must close this gap for every membership transfer, not only ones the compiler already recognizes as compound.

**Known production gap:** graduated (S6, 2026-07-11) into [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) --- "Phase C sandbox" section, "Known gap" paragraph. Not restated here; that doc is now authoritative.

**Pipeline decomposition (2026-07-12):** this sandbox is now understood as the **Synthesize**-stage validation half of a three-job pipeline (Identify / Plan / Synthesize) --- vocabulary in [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md). `interactionUnderTransfer.ts` / `computeCarryClosure` do Synthesize-stage closure work that module-wise sits next to this sandbox's pure-validation code as a naming artifact, not a design requirement --- no code change from this, noted here only so a cold read of this closed plan isn't surprised by the later reframe.

## Scope

### In scope

- A pure **reducer**: `(instructions, currentGraphs: Record<hostId, EphemeraPositionGraph>) -> { verdict, decidable, resultGraphs? } | { verdict: 'illegal' | 'defer', decidable, reason }`. No persist, no Dynamo reads --- hydrates from **ingress-packaged context** (room + held catalogs/graph) already assembled for the command. `resultGraphs` (immutable-reduce output, per SB-4 representation) is generic sandbox output, not a shape fitted to any one downstream consumer (SB-3, resolved by merge into SB-4) --- C2's transcript builder and FT-5's Consult menu each derive what they need from it independently.
- **Compound simulation:** apply step 1 of a plan to an in-memory copy of state, then evaluate step 2 against the mutated copy (not the original). Reuses the sandbox's per-step primitive (shipped validators + the universal interaction-under-transfer check below) for each step --- no separate compound-only logic path.
- **Deterministic interaction-under-transfer semantics per enum relation** (the modeled core that makes enum fast-approve legitimate): e.g. `On` dissolves freely on pickup; `Under` may block or require composition before a transfer is legal (table graduated to [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md), "Phase C sandbox" section). `Custom` / unmodeled blast radius has no such core and routes to the LLM validator (BD-10 `defer`) instead of the sandbox.
- **Universal gating, not compound-only:** every `transferMembership` step (single-step *or* the Nth step of a compound plan) must check **all** relational edges touching the transferred object --- whether it plays subject or target in that edge --- against the SB-5 table before the step is allowed. The shipped `validateMembershipPlanDryRun` (exit-edge check) is composed with this new relational-edge check, not replaced by it; the sandbox's single-step primitive is the union of both, applied uniformly regardless of plan length.
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

## Design debt (carried over from fault-tolerant gateway retirement, 2026-07-10; graduated 2026-07-11)

The two bullets specific to this sandbox's own scope --- "dry-run over an in-memory sandbox" and "enum relations need deterministic interaction-under-transfer semantics" --- are now shipped and graduated into [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) ("Phase C sandbox" section). The remaining bullets (propose-N selection rubric, staged fast-path composition, proposer/validator split at large) are **C1-scoped**, not this sandbox's, and are already tracked authoritatively in the **parent** plan's "Phase C design debt" section --- not duplicated here anymore.

## Open decisions (implementation --- plan only)

**None open.** All of SB-1--SB-5 (multi-host scope, rule table location, `resultPreview`/output representation, state representation, interaction-under-transfer rule content) were decided, shipped, and graduated (2026-07-11) into [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) ("Phase C sandbox" section) --- including the three-outcome table, the `carry`-transitive-to-fixpoint worked example, cycle safety, and the construction-vs-validation split. The full per-decision history (confirmations against shipped code, dates) remains in git history for this file; not duplicated here to avoid two copies drifting.

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

- [X] **S1. Resolve open decisions (SB-1 -- SB-5)**
  - [X] Confirm multi-host scope for v1 (SB-1) --- decided: sandbox state is keyed by `hostId` across room **and** character hosts; `takeHold`/`drop` are cross-host today, so single-host was never a valid v1 simplification.
  - [X] Decide interaction-under-transfer rule table location (SB-2) --- new module `interactionUnderTransfer.ts`.
  - [X] Resolve `resultPreview` question (SB-3) --- merged into SB-4; no bespoke preview shape.
  - [X] Decide in-memory state representation (SB-4) --- clone-and-mutate typed snapshot, keyed by `hostId`, same shape for input and output.
  - [X] Lock interaction-under-transfer rule content (SB-5) --- load-bearing/constraining-endpoint principle; see table.

- [X] **S2. Interaction-under-transfer rule table** (moved ahead of single-step composition --- S3 now depends on it) --- **Done (2026-07-10)**
  - [X] Create `interactionUnderTransfer.ts` (per SB-2) under `enrich/objectManipulation/`; implement the SB-5 table with **three** outcomes (`dissolve` / `carry` / `defer`) per relation kind and moved-endpoint role (`classifyInteractionUnderTransfer`), keyed to check **any** edge touching a given object regardless of whether it plays subject or target (`roleOfObjectInEdge`).
  - [X] Expose a **transfer-set closure helper** (`computeCarryClosure`): given a starting object and a host graph, absorb objects connected via `carry`-classified edges **to a fixpoint** --- re-examine each newly-absorbed object's own edges for further `carry` links, not just the originally-named object's edges (see SB-5 worked example: glass on book on tray). Guarded by the closure set itself (an already-absorbed id is never re-enqueued), which doubles as cycle safety. **Ownership (see "Construction vs. validation" in [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md), "Phase C sandbox" section):** this is a *construction-time* helper --- the parent plan's C1 compiler calls it to build a complete multi-member `transferMembership` candidate. The sandbox (S3) does **not** call it to expand a candidate it's evaluating; S3 uses `boundaryEdgeOutcomes` only to confirm a candidate's declared transfer set is already closed, failing validation if it isn't.
  - [X] **Added beyond the original bullet list:** `boundaryEdgeOutcomes(transferSet, graph)` --- given a resolved transfer set, returns the edges crossing its boundary (exactly one endpoint in the set) with each classified. S3/S4 need this regardless of who builds it, and it let S2's own test suite prove the classifier + closure compose correctly rather than just checking closure membership in isolation.
  - [X] **Scope decision (confirmed with user, 2026-07-10): do not wire into `evaluateRelationalLegality.ts` in this slice.** Its `complexRelational` catch-all answers a different question (legality of *establishing* a new relation given existing topology) than interaction-under-transfer (what happens to an *existing* relation when an object *transfers*) --- there is no concrete consumer yet. Deferred to S3 for a concrete judgment. **Resolved in S3 (2026-07-10): closed permanently, not merely deferred.** Interaction-under-transfer only ever governs `transferMembership` steps; `establishRelation`/`dissolveRelation` create/remove an edge directly and never touch this table. There is no integration point and there will not be one --- `evaluateRelationalLegality.ts` remains untouched by design, and `sandboxStep.ts`'s `applyRelationalStep` composes `validateRelationalPlanDryRun` with no interaction-under-transfer involvement.
  - [X] **Discovery for BD-13 (kernel side, tracked in parent plan):** `applyRelationalPatch` ([`positions/positionGraph/index.ts:312-344`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/index.ts)) hard-rejects any host that isn't a room (`isEphemeraRoomId` guard, line 316) --- relevant when BD-13's kernel work needs to recreate a `carry`-ed edge on a Character-hosted destination graph; that path doesn't exist today and will need this guard revisited. Not this slice's job to fix; recorded so it isn't rediscovered cold later.
  - [X] Tests (`interactionUnderTransfer.test.ts`, 16 passing): all 8 relation-kind x moved-role combinations including `On`/target now `carry`; `roleOfObjectInEdge` subject/target/none; single-hop and **three-deep chain** closure (glass on book, book on tray, "get tray" --- absorbs all three); `Under` edge absorbed in neither direction; malformed cyclic edge set terminates; `boundaryEdgeOutcomes` reports only the true external edge on a resolved three-object transfer set.

- [X] **S3. Sandbox state + single-step composition** --- **Done (2026-07-10)**
  - [X] **No new type** (SB-4 refinement), shipped as [`sandboxState.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxState.ts): `SandboxState = Map<EphemeraMembershipHostId, EphemeraPositionGraph>` + `buildSandboxState(graphs)`, mirroring `applyHostEffects.ts`'s `graphsByHost` pattern exactly.
  - [X] Shipped as [`sandboxStep.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxStep.ts): `applyTransferMembershipStep` wraps `validateMembershipPlanDryRun` **composed with** the S2 interaction-under-transfer check (`boundaryEdgeOutcomes`) --- base check runs first and its outcome is returned verbatim on non-`legal`, so existing behavior (including exit-edge defer) is fully preserved; the new check only adds a further gate when the base check passes. `applyRelationalStep` wraps `validateRelationalPlanDryRun` with **no** interaction-under-transfer involvement (see S2's resolved item above).
  - [X] **Validate completeness; never expand** (see "Construction vs. validation" in [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md)), confirmed in code: a `carry`-classified boundary edge on the declared transfer set returns **`illegal`** (not `defer`) with a new dedicated reason, `objectManipulationErrorMessages.incompleteTransferSet` --- distinct from genuine BD-10 `defer` (`Under`/subject-move, `Custom`), which uses a separate reason (`transferInteractionDefer`) and correctly varies `decidable` (`true` for `Under`, `false` for `Custom`, matching the existing decidable convention: false only when an LLM validator tier would be needed). The sandbox never calls `computeCarryClosure` to expand a set --- growing the set stays exclusively a construction-time (C1 compiler) responsibility.
  - [X] **Internal-edge recreation shipped here, not S4** (scope correction --- applying one `transferMembership` step, complete or not, includes recreating its transfer set's internal edges on the destination host; S4 only needs to chain multiple such single-step calls, not reimplement this). Implementation uses `addRelationalEdge` (not `applyRelationalPatch`) specifically because the sandbox never persists and so isn't subject to `applyRelationalPatch`'s room-only guard (the BD-13 kernel blocker recorded in S2) --- that guard only matters once real persistence needs to write a carried edge onto a Character host.
  - [X] Tests (`sandboxStep.test.ts`, 8 passing): baseline parity (no relational edges, behavior unchanged); exit-edge defer preserved through composition; **incomplete** candidate (`transferMembership(tray)` alone, glass left out) --- `illegal`/`incompleteTransferSet`, no `state` on the outcome; **complete** candidate (`transferMembership({tray, glass})`) --- `legal`, destination host gains both objects **and** the recreated `glass On tray` edge, source host loses both and the edge; genuine `Under` defer (`decidable: true`); `Custom` defer (`decidable: false`); `applyRelationalStep` parity + legal-apply case. Full objectManipulation suite: 59 suites / 418 tests, zero regressions.

- [X] **S4. Compound simulation** --- **Done (2026-07-10)**
  - [X] Shipped as [`sandboxPlan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxPlan.ts): `evaluateSandboxPlan(initialState, steps)` folds over `SandboxPlanStep[]`, dispatching each step to S3's `applyTransferMembershipStep` / `applyRelationalStep` and threading the returned `SandboxState` forward --- no reimplementation of single-step logic; internal-edge recreation stayed in S3 as scoped. **`SandboxPlanStep` is sandbox-internal test/plan scaffolding, not the Plan IR** --- the parent plan's C1 (`ParsePlanStep` union) hasn't landed; when it does, it either reuses this shape or adapts into it. Flagged for whoever picks up C1.
  - [X] BD-9 semantics enforced by construction, not a special case: the fold returns the first non-`legal` outcome immediately, and because `illegal`/`defer` outcomes carry no `state` field (reused from S3's `SandboxStepOutcome`, no new type), an aborted plan cannot leak a partially-applied state --- the type system itself rules it out.
  - [X] Tests (`sandboxPlan.test.ts`, 5 passing): empty plan is a no-op; **BD-8 golden path** (drop then establishRelation) --- chosen specifically because it proves state-threading is real, not incidental (step 2's "both nodes on host graph" check would fail against the pre-drop room graph, since the held object isn't a node there until step 1's effect applies); **BD-9 abort** (conflicting second step) --- asserts the returned outcome has no `state` field at all; **"get tray" 2-step compound** (dissolve + carry) end-to-end through the actual loop, not hand-assembled state; **three-deep chain** compound (glass on book, book on tray, "get tray") --- final Character-host state has all three objects and both internal edges. Full objectManipulation suite: 60 suites / 423 tests, zero regressions.

- [X] **S5. `resultGraphs` + wiring (readiness, not production wiring)** --- **Done (2026-07-11)**
  - [X] **`resultGraphs` already delivered, no rename.** `evaluateSandboxPlan`'s (S4) `legal` outcome already carries `state: SandboxState`, which *is* `resultGraphs` --- renaming the field would touch shipped, tested code (`SandboxStepOutcome` in `sandboxStep.ts`) for a purely cosmetic reason. Documented as an equivalence, not built as new code.
  - [X] **Scope-corrected (confirmed with user, 2026-07-11): no C1 selector exists to wire into** ("wire into the C1 selector" was premature --- C1 hasn't started). What exists is the **already-shipped, live** production selector core, `selectPlanTuple` ([`selectIdentityPlanTuple.ts:56`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/selectIdentityPlanTuple.ts)), generic over a `dryRun` callback. **Decided: prove wireability, do not wire production.** Wiring `selectIdentityPlanTuple.ts:167` / `selectMembershipFromPool.ts` to the sandbox now would flip shipped Phase B behavior before C1 can construct correct multi-member candidates --- see the "Known production gap" note under Purpose.
  - [X] Shipped as [`sandboxSelectorReadiness.test.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxSelectorReadiness.test.ts): a test-only adapter turns `evaluateSandboxPlan`'s outcome into the `(candidate) => DryRunOutcome` shape `selectPlanTuple` already expects, then threads real candidates through the **real, unmodified** `selectPlanTuple` core. `selectIdentityPlanTuple.ts` and `selectMembershipFromPool.ts` are untouched.
  - [X] Tests (3 passing): single legal candidate → `resolved`; two legal candidates with a thin confidence margin → `consult` with correct alternatives; a candidate that's `illegal` specifically via the sandbox's new `incompleteTransferSet` reason (something `validateMembershipPlanDryRun` alone could never produce) → `error` with that exact reason, proving the sandbox's *new* behavior --- not just its old-validator-compatible behavior --- flows correctly through unmodified selector code. Full objectManipulation suite: 61 suites / 426 tests, zero regressions.

- [X] **S6. Durable docs** --- **Done (2026-07-11)**
  - [X] Graduated shipped behavior into [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) --- new "Phase C sandbox (built, not yet wired into production)" section: multi-host state shape, the three-outcome interaction-under-transfer table + reasoning, `carry`-transitive-to-fixpoint + internal/boundary edges, construction-vs-validation split, and the known production gap. **`positions/AGENT.contract.md` intentionally not touched** --- nothing in `positions/` shipped as part of this work (the sandbox only calls `EphemeraPositionGraph`'s existing API); adding a contract clause for BD-13's not-yet-shipped kernel change would be the "wishlist normative text" anti-pattern `taskPlanning/AGENT.md` warns against.
  - [X] Removed resolved rows from **Open decisions** above --- replaced with a one-paragraph pointer to the graduated doc.
  - [ ] Delete this planning file once C1 (parent plan) consumes the sandbox and Phase C steady-state docs land; git retains history. **Correctly still pending** --- C1 has not started.

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
| SB-1 (multi-host scope) | **Decided (2026-07-10)** --- sandbox state keyed by `hostId`, room + character both |
| SB-5 (interaction-under-transfer rule content) | **Decided (2026-07-10); revised (2026-07-10)** --- three outcomes (`dissolve`/`carry`/`defer`); `On`/target-moves now `carry`, not `defer` (BD-13) |
| SB-2 (rule table location) | **Decided (2026-07-10)** --- new module `interactionUnderTransfer.ts` |
| SB-3 (resultPreview contents) | **Resolved (2026-07-10)** --- merged into SB-4; sandbox is a pure reducer, no bespoke preview shape |
| SB-4 (state representation) | **Decided (2026-07-10)** --- clone-and-mutate typed snapshot, keyed by `hostId`, same shape in and out |
| **S1 (all open decisions)** | **Done (2026-07-10)** --- SB-1 -- SB-5 all decided/resolved |
| Scope correction: universal gating (not compound-only) | Done (2026-07-10) --- membership transfer must check relational edges even in length-1 plans; "pick up tray" (glass `On` tray) example |
| BD-13 multi-member `transferMembership` + carry (cross-ref) | **Decided (2026-07-10)** --- kernel/primitive side tracked in parent plan; see [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) BD-13 |
| S2 interaction-under-transfer rule table | **Done (2026-07-10)** --- [`interactionUnderTransfer.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/interactionUnderTransfer.ts) + 16 tests; `evaluateRelationalLegality.ts` wiring resolved (S3: closed permanently, no integration point exists); BD-13 kernel discovery (`applyRelationalPatch` room-only guard) recorded |
| S3 sandbox state + single-step composition | **Done (2026-07-10)** --- [`sandboxState.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxState.ts) + [`sandboxStep.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxStep.ts), 8 tests; incomplete-transfer-set verdict decided as `illegal` (not `defer`); internal-edge recreation shipped here (moved from S4) |
| S4 compound simulation | **Done (2026-07-10)** --- [`sandboxPlan.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxPlan.ts), 5 tests; `SandboxPlanStep` flagged as sandbox-internal scaffolding, not Plan IR |
| S5 resultGraphs + wiring | **Done (2026-07-11)** --- [`sandboxSelectorReadiness.test.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxSelectorReadiness.test.ts), 3 tests; readiness proven via test-only adapter, **no production wiring** (scope-corrected); known production gap recorded (graduated to `objectManipulation/AGENT.md` in S6) |
| S6 durable docs | **Done (2026-07-11)** --- graduated into [`objectManipulation/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/AGENT.md) ("Phase C sandbox" section); Open Decisions table + SB-5 detail + Construction-vs-validation subsections trimmed from this plan; file **not deleted** (correct --- C1 hasn't consumed the sandbox yet) |
