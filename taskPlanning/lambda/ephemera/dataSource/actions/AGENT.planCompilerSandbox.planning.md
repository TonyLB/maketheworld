# Plan-compiler dry-run sandbox (Phase C prerequisite)

**Status:** Design decided (SB-1 -- SB-5 all Decided/Resolved, 2026-07-10); **S2 shipped (2026-07-10)** --- `interactionUnderTransfer.ts` (classifier, closure, boundary helper), 16 tests. **S3 shipped (2026-07-10)** --- `sandboxState.ts` + `sandboxStep.ts` (first real consumer of S2), 8 tests, 418/418 passing objectManipulation-wide, zero regressions. S4 next. Split out of [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) (2026-07-10) --- that plan's Phase C design debt named this as a prerequisite for C1 but carried no `Recommended order` of its own. This sibling plan owns just the sandbox: design debt consolidation, open decisions, and a build checklist.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

**Parent / sibling relationship:** [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md) owns Phase C's Plan IR, compiler, and executor work generally (C1--C5). This plan owns only the **dry-run legality sandbox** the C1 compiler/validator consumes. Land this plan's C1 items alongside (or just ahead of) the parent's C1 checklist --- the parent's compiler cannot emit a validated candidate without this sandbox existing.

## Purpose

Phase B shipped two **single-step** dry-run validators --- [`validatePlanDryRun.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/validatePlanDryRun.ts): `validateMembershipPlanDryRun` (FT-2.2) and `validateRelationalPlanDryRun` (FT-3.3). Both evaluate one candidate plan against **current** graph/catalog state; neither simulates a hypothetical post-step state. Their membership docstring says outright "No compound sandbox."

Phase C composition (BD-8: auto-insert `drop` before `establishRelation`; BD-9: atomic multi-step apply) needs a validator that can tell whether a **compound** plan is legal **before** any real `transactWrite` --- which requires simulating the intermediate state a compound plan passes through (e.g. after the simulated `drop`, is the object now eligible for `establishRelation`?). That simulator is this sandbox.

**Not compound-only (corrected 2026-07-10):** the same question arises for an ordinary **length-1** `transferMembership` step with no relational step at all --- "pick up the tray" when a glass is `On` the tray must ask exactly the same interaction-under-transfer question (SB-5) as a BD-8 composed plan does, because the tray is the **target** of an existing relational edge. Today's shipped `validateMembershipPlanDryRun` has no mechanism for this --- it only checks exit edges (room connections), never relational edges. The sandbox must close this gap for every membership transfer, not only ones the compiler already recognizes as compound.

## Scope

### In scope

- A pure **reducer**: `(instructions, currentGraphs: Record<hostId, EphemeraPositionGraph>) -> { verdict, decidable, resultGraphs? } | { verdict: 'illegal' | 'defer', decidable, reason }`. No persist, no Dynamo reads --- hydrates from **ingress-packaged context** (room + held catalogs/graph) already assembled for the command. `resultGraphs` (immutable-reduce output, per SB-4 representation) is generic sandbox output, not a shape fitted to any one downstream consumer (SB-3, resolved by merge into SB-4) --- C2's transcript builder and FT-5's Consult menu each derive what they need from it independently.
- **Compound simulation:** apply step 1 of a plan to an in-memory copy of state, then evaluate step 2 against the mutated copy (not the original). Reuses the sandbox's per-step primitive (shipped validators + the universal interaction-under-transfer check below) for each step --- no separate compound-only logic path.
- **Deterministic interaction-under-transfer semantics per enum relation** (the modeled core that makes enum fast-approve legitimate): e.g. `On` dissolves freely on pickup; `Under` may block or require composition before a transfer is legal (see SB-5 detail below). `Custom` / unmodeled blast radius has no such core and routes to the LLM validator (BD-10 `defer`) instead of the sandbox.
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
| SB-1 | **Multi-host scope** --- **decided: yes, the sandbox must simulate multi-host state in v1.** Confirmed (2026-07-10) against shipped code: `takeHold`/`drop` are already cross-host today --- each Room and each Character owns its own `EphemeraPositionGraph` (`Meta::Room.positionGraph` / `Meta::Character.positionGraph`), joined only by adjacency index, not containment. `applyObjectTakeHold.ts` (`positions/manipulation/membership/applyObjectTakeHold.ts:61-129`) produces a `roomDiff` + `characterDiff` in one `HostEffect[]` list; the kernel `applyHostEffects.ts` is host-agnostic by construction (dedupes `affectedHostIds` across arbitrarily many hosts, one `transactWrite`). BD-6 ("host = actor's current room") was scoped to the **relational** operator's edge-host choice only, never a single-host claim for the whole manipulation vertical. A BD-8 composed plan (`drop` then `establishRelation`) therefore already touches **two** graphs (Character's, losing the object; Room's, gaining it + the new edge) before `establishRelation` even runs. | Sandbox state shape | **Decided (2026-07-10)** |
| SB-2 | **Interaction-under-transfer rule table location** --- **decided (2026-07-10): new module** (e.g. `interactionUnderTransfer.ts` under [`enrich/objectManipulation/`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/)), not inlined into the sandbox evaluator. Consumed by the sandbox's single-step and compound checks (S3/S4) and `evaluateRelationalLegality.ts` where relevant, so the SB-5 rule table has one authoritative home rather than being duplicated or coupled to sandbox internals. | Sandbox build order | **Decided (2026-07-10)** |
| SB-3 | ~~`resultPreview` contents~~ --- **resolved by merge into SB-4 (2026-07-10):** not a distinct question. The sandbox is a pure reducer over `EphemeraPositionGraph` items, not a validator fitted to specific downstream consumers --- its success output *is* the reduced graph set (per SB-4 representation), plus validity errors on failure. C2's transcript builder and FT-5's Consult menu each read whatever they need from that same generic output; the sandbox does not compute a bespoke preview shape for either. | N/A | **Resolved (merged into SB-4)** |
| SB-4 | **In-memory state representation** --- **decided (2026-07-10): clone-and-mutate a typed snapshot**, not a diff/patch-list. **Refined (2026-07-10): no new type needed.** `EphemeraPositionGraph` is already an immutable value type --- `.addObject()` / `.removeObject()` / `.addRelationalEdge()` / `.removeRelationalEdge()` / `.applyMembershipEffect()` / `.applyRelationalPatch()` all already return a **new** instance rather than mutating in place (`positions/positionGraph/index.ts`). "Clone-and-mutate" means calling one of these existing methods and taking the returned instance as the next snapshot --- not building new mutation machinery. The only genuinely new piece is the **multi-host bundle** (SB-1): `SandboxState = Map<EphemeraMembershipHostId, EphemeraPositionGraph>`, mirroring the shipped kernel's own `graphsByHost` pattern in [`applyHostEffects.ts:26`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts) --- reuse that convention rather than inventing a parallel one. A step's effect looks up the relevant host's entry, calls the appropriate existing method, and replaces that entry with the returned instance; the next step reads the updated map. This is also the output representation (subsumes SB-3): the reducer's success result is the same `Map<hostId, EphemeraPositionGraph>` (`resultGraphs`), not a separate diff, preview, or bespoke type. | Compound simulation step; sandbox evaluator signature | **Decided (2026-07-10)** |
| SB-5 | **Interaction-under-transfer rule content** --- **decided (2026-07-10):** per relation kind, whether dissolving on transfer is deterministically clean or requires interaction assessment depends on **which endpoint plays the load-bearing / constraining role**, not a fixed subject-vs-target split. See table below. | S2 rule table | **Decided (2026-07-10)** |

### SB-5 detail: interaction-under-transfer table (revised 2026-07-10 --- three outcomes)

Principle: the endpoint whose movement is ambiguous is the one that physically supports or spatially constrains the other. `On` and `Under` are **not** mirror images of the same physical fact --- `On` encodes a load relation (target supports subject); `Under` encodes a spatial/enclosure relation (target does not support subject, but its geometry may constrain subject's removal). `Against` encodes neither, so it is symmetric.

**Revision (BD-13, informed by parent-plan multi-member `transferMembership`):** a third outcome, **`carry`**, replaces `defer` wherever the ambiguity is resolvable by absorbing the other endpoint into the transfer set rather than leaving its fate undecided. `carry` only applies where there is an actual object to absorb (a load relation, `On`) --- it does **not** apply to `Under`'s subject-move case, where the ambiguity is spatial clearance, not "what happens to some other object," and there is nothing to carry.

**Internal vs. boundary (BD-13):** an edge where *both* endpoints move together as one transfer set (because one absorbed the other via `carry`) is **internal** --- never evaluated, never dissolved, simply preserved (recreated on the destination host graph). Only edges crossing the **boundary** of the transfer set (one endpoint in the set, one outside it) are evaluated against this table at all.

| Relation kind | Subject moves (transfer) | Target moves (transfer) | Why |
| --- | --- | --- | --- |
| `On` | Clean dissolve | **Carry** (absorb subject into transfer set --- revised from `defer`, BD-13) | Target supports subject; when the target moves, the sane deterministic default is "the subject comes with it" (get the tray, the glass on it comes too) rather than leaving the outcome ambiguous. Subject-move alone is a trivial pick-up --- nothing rests on the subject in this relation, so it dissolves cleanly with nothing to carry. |
| `Under` | **Defer** (interaction assessment --- unchanged, no carry partner) | Clean dissolve | Target does not support subject (no load relation) --- target-move has no bearing on subject, so it dissolves cleanly. Subject-move may be spatially constrained by target's geometry (clearance); there is no other object to absorb, so this stays a genuine `defer`. |
| `Against` | Clean dissolve | Clean dissolve | Casual/lateral contact, no load-bearing or enclosure role either direction --- loosest relation, breaks cleanly regardless of which endpoint moves; never `carry` (a broom leaning against a moved table should fall, not be lifted with it). |
| `Custom` | N/A --- always defer | N/A --- always defer | Unmodeled; not this table's concern (BD-10). |

**Reconciles with BD-10 and BD-9, does not add an ad-hoc verdict:** every remaining "Defer" cell above is still the existing **BD-10 `defer` bucket** --- Phase B/C terminalizes it as the Error stub, Phase D's plan-LLM is the eventual escalation path. **`carry` is not a sandbox verdict at all --- it is a cascade flag consumed at plan-construction time, not a validation return.** It never appears in `{verdict, decidable, resultGraphs}` (SB-4); it only tells the party *building* a `transferMembership` candidate which additional objects belong in the transfer set. See "Construction vs. validation" below for why this distinction is load-bearing, not stylistic.

**`carry` is transitive (closure to fixpoint, not one hop):** worked example --- `glass On book`, `book On tray`, command "get tray."

1. Tray is the object named in the transfer. Examine tray's edges: `book On tray` --- target (tray) moves, `On`/target-moves = **carry**. Absorb book into the transfer set.
2. **Re-examine the newly absorbed object's edges** (not just the originally-named object's): book's edges include `glass On book` --- target (book) moves (book is now also in the transfer set), `On`/target-moves = **carry** again. Absorb glass.
3. Glass has no further edges. Closure terminates: transfer set = `{tray, book, glass}`. Both `book On tray` and `glass On book` are **internal** to the set --- preserved untouched, recreated on the destination host graph. No boundary edges remain to evaluate (tray's dissolved `On table` edge, if any, is the only true boundary edge, handled separately by BD-8 composition).

**Cycle safety:** the closure walk must track a visited-set and terminate on re-encountering an already-absorbed object, since nothing today guarantees the relational-edge graph is acyclic --- a malformed or adversarial state must not infinite-loop the sandbox.

### Construction vs. validation (decided 2026-07-10): the sandbox never expands a transfer set

Two places in the pipeline could own `computeCarryClosure`'s output: (1) **plan construction** --- the deterministic compiler (and, eventually, any LLM-plan normalization step) calls it while *building* a `transferMembership` candidate, so the candidate it emits is already complete; or (2) **the sandbox** --- accept whatever transfer set a candidate names, and silently expand it to the correct carried set before evaluating. **Decided: (1), not (2).** The sandbox validates completeness and returns `illegal`/`defer` on an incomplete transfer set --- it does **not** auto-expand one, even though it has the closure helper available and could.

Why this is a real decision and not just a style preference:

- **FT-5 confidence integrity.** Selection confidence is computed against the *proposed* candidate. If the sandbox silently pulled the glass into a "get tray" plan that only named the tray, the persisted result would include an object nothing ever scored, Consulted, or Abstained on --- confidence and outcome would no longer refer to the same plan.
- **The proposer/validator split holds even when both are deterministic** (carried over from the design debt above): the validator is the *single shared legality authority* every proposer --- deterministic or LLM --- must pass. A validator that repairs candidates instead of rejecting them becomes a second, silently-divergent compiler with its own rules.
- **Not the same kind of fault-tolerance as FT-2 -- FT-7.** Those tolerated *uncertainty in identity/grounding* (confidence bands, Abstain/Consult). Auto-expanding a transfer set changes *what the plan does*, which is closer to the committed-premature-structure failure FT-7 walked back, just relocated from classify to the validator.
- **Debuggability.** A compiler bug in closure construction should surface where it's owned. If the sandbox quietly patches incomplete candidates, the bug hides behind "the sandbox handled it."

**Practical consequence for S3/C1:** `computeCarryClosure` and `boundaryEdgeOutcomes` are exposed as shared, importable functions precisely so the *same* logic runs in both places without duplication --- the compiler calls them to construct a complete candidate; the sandbox calls them (or an equivalent completeness check) only to confirm the candidate it was handed already reflects that closure, never to build one of its own accord. When the sandbox finds a `carry`-classified boundary edge on a candidate it's validating, that is itself evidence the candidate under-specified its transfer set --- the correct response is to fail validation, not to treat `carry` as an instruction to go recompute a bigger one.

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
  - [X] Expose a **transfer-set closure helper** (`computeCarryClosure`): given a starting object and a host graph, absorb objects connected via `carry`-classified edges **to a fixpoint** --- re-examine each newly-absorbed object's own edges for further `carry` links, not just the originally-named object's edges (see SB-5 worked example: glass on book on tray). Guarded by the closure set itself (an already-absorbed id is never re-enqueued), which doubles as cycle safety. **Ownership (see "Construction vs. validation" below):** this is a *construction-time* helper --- the parent plan's C1 compiler calls it to build a complete multi-member `transferMembership` candidate. The sandbox (S3) does **not** call it to expand a candidate it's evaluating; S3 uses `boundaryEdgeOutcomes` only to confirm a candidate's declared transfer set is already closed, failing validation if it isn't.
  - [X] **Added beyond the original bullet list:** `boundaryEdgeOutcomes(transferSet, graph)` --- given a resolved transfer set, returns the edges crossing its boundary (exactly one endpoint in the set) with each classified. S3/S4 need this regardless of who builds it, and it let S2's own test suite prove the classifier + closure compose correctly rather than just checking closure membership in isolation.
  - [X] **Scope decision (confirmed with user, 2026-07-10): do not wire into `evaluateRelationalLegality.ts` in this slice.** Its `complexRelational` catch-all answers a different question (legality of *establishing* a new relation given existing topology) than interaction-under-transfer (what happens to an *existing* relation when an object *transfers*) --- there is no concrete consumer yet. Deferred to S3 for a concrete judgment. **Resolved in S3 (2026-07-10): closed permanently, not merely deferred.** Interaction-under-transfer only ever governs `transferMembership` steps; `establishRelation`/`dissolveRelation` create/remove an edge directly and never touch this table. There is no integration point and there will not be one --- `evaluateRelationalLegality.ts` remains untouched by design, and `sandboxStep.ts`'s `applyRelationalStep` composes `validateRelationalPlanDryRun` with no interaction-under-transfer involvement.
  - [X] **Discovery for BD-13 (kernel side, tracked in parent plan):** `applyRelationalPatch` ([`positions/positionGraph/index.ts:312-344`](../../../../../lambda/ephemera/dataSource/positions/positionGraph/index.ts)) hard-rejects any host that isn't a room (`isEphemeraRoomId` guard, line 316) --- relevant when BD-13's kernel work needs to recreate a `carry`-ed edge on a Character-hosted destination graph; that path doesn't exist today and will need this guard revisited. Not this slice's job to fix; recorded so it isn't rediscovered cold later.
  - [X] Tests (`interactionUnderTransfer.test.ts`, 16 passing): all 8 relation-kind x moved-role combinations including `On`/target now `carry`; `roleOfObjectInEdge` subject/target/none; single-hop and **three-deep chain** closure (glass on book, book on tray, "get tray" --- absorbs all three); `Under` edge absorbed in neither direction; malformed cyclic edge set terminates; `boundaryEdgeOutcomes` reports only the true external edge on a resolved three-object transfer set.

- [X] **S3. Sandbox state + single-step composition** --- **Done (2026-07-10)**
  - [X] **No new type** (SB-4 refinement), shipped as [`sandboxState.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxState.ts): `SandboxState = Map<EphemeraMembershipHostId, EphemeraPositionGraph>` + `buildSandboxState(graphs)`, mirroring `applyHostEffects.ts`'s `graphsByHost` pattern exactly.
  - [X] Shipped as [`sandboxStep.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/sandboxStep.ts): `applyTransferMembershipStep` wraps `validateMembershipPlanDryRun` **composed with** the S2 interaction-under-transfer check (`boundaryEdgeOutcomes`) --- base check runs first and its outcome is returned verbatim on non-`legal`, so existing behavior (including exit-edge defer) is fully preserved; the new check only adds a further gate when the base check passes. `applyRelationalStep` wraps `validateRelationalPlanDryRun` with **no** interaction-under-transfer involvement (see S2's resolved item above).
  - [X] **Validate completeness; never expand** (see "Construction vs. validation" above), confirmed in code: a `carry`-classified boundary edge on the declared transfer set returns **`illegal`** (not `defer`) with a new dedicated reason, `objectManipulationErrorMessages.incompleteTransferSet` --- distinct from genuine BD-10 `defer` (`Under`/subject-move, `Custom`), which uses a separate reason (`transferInteractionDefer`) and correctly varies `decidable` (`true` for `Under`, `false` for `Custom`, matching the existing decidable convention: false only when an LLM validator tier would be needed). The sandbox never calls `computeCarryClosure` to expand a set --- growing the set stays exclusively a construction-time (C1 compiler) responsibility.
  - [X] **Internal-edge recreation shipped here, not S4** (scope correction --- applying one `transferMembership` step, complete or not, includes recreating its transfer set's internal edges on the destination host; S4 only needs to chain multiple such single-step calls, not reimplement this). Implementation uses `addRelationalEdge` (not `applyRelationalPatch`) specifically because the sandbox never persists and so isn't subject to `applyRelationalPatch`'s room-only guard (the BD-13 kernel blocker recorded in S2) --- that guard only matters once real persistence needs to write a carried edge onto a Character host.
  - [X] Tests (`sandboxStep.test.ts`, 8 passing): baseline parity (no relational edges, behavior unchanged); exit-edge defer preserved through composition; **incomplete** candidate (`transferMembership(tray)` alone, glass left out) --- `illegal`/`incompleteTransferSet`, no `state` on the outcome; **complete** candidate (`transferMembership({tray, glass})`) --- `legal`, destination host gains both objects **and** the recreated `glass On tray` edge, source host loses both and the edge; genuine `Under` defer (`decidable: true`); `Custom` defer (`decidable: false`); `applyRelationalStep` parity + legal-apply case. Full objectManipulation suite: 59 suites / 418 tests, zero regressions.

- [ ] **S4. Compound simulation**
  - [ ] Implement the mutate-and-reevaluate loop: call S3's `applyTransferMembershipStep` / `applyRelationalStep` once per step in a compound plan, threading the returned `SandboxState` forward as the next step's input state --- **not** a reimplementation of single-step logic (internal-edge recreation already lives in S3).
  - [ ] Enforce BD-9 semantics in the simulation itself: if any step is illegal/deferred, the whole plan reports as such (no partial-legal plans).
  - [ ] Tests: held object + surface relation composed plan (BD-8 golden path, using S3's two step functions in sequence); a case where the interaction rule blocks composition (e.g. `Under` conflict); "get tray" (dissolve + carry) end-to-end producing correct final `SandboxState` on both hosts; **three-deep chain** (glass on book, book on tray, "get tray") --- final state on the Character host must show all three objects plus both internal edges recreated.

- [ ] **S5. `resultGraphs` + wiring**
  - [ ] Implement the reducer's success output (`resultGraphs`, per SB-4 representation) --- the reduced `EphemeraPositionGraph` set, no bespoke preview shape.
  - [ ] Wire sandbox output into the C1 selector: enum -> sandbox fast-approve tier; `Custom` / unmodeled -> LLM validator tier (BD-10 `defer`).
  - [ ] Tests: end-to-end candidate -> sandbox verdict -> selector outcome, including a Consult case where downstream code derives a candidate comparison from `resultGraphs` (not a sandbox-computed preview).

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
| S4 compound simulation | Not started |
| S5 resultGraphs + wiring | Not started |
| S6 durable docs | Not started |
