# AGENT.planModePrep.process.md (Fourth Draft - Phase-Oriented with CONSULT & Loop Semantics)

**Companion:** [Prep artifact schema](AGENT.planModePrep.schema.md) (sections A-E and `AGENT.planning.prep.md` structure).

## Purpose

Prepare planning work so Plan Mode can execute without inventing architecture, contracts, or scope.

---

## Core Doctrine

- Prefer existing patterns over invention
- Surface material uncertainty
- Ground decisions in inspected code
- Require explicit review for meaningful change
- Block premature readiness

---

## Material Uncertainty Standard

An uncertainty is **material** if resolving it could affect:

- architecture
- code placement across modules
- shared contracts
- abstraction boundaries
- scope boundaries
- reusable patterns
- verification expectations
- future maintenance burden

### Non-material uncertainty

Local, low-risk, easily reversible:

- naming
- small local helpers
- trivial structure

### Consequence Check

Before treating uncertainty as non-material:

- Would this create or change a shared abstraction?
- Would this affect code outside this module?
- Would this lock in a future assumption?
- Would a reviewer care if this were silent?

If yes or maybe → treat as material.

### Borderline Rule

If unsure whether material:

- surface it explicitly
- explain what would determine the answer

---

## Process Overview

Prep work proceeds as a multi-pass loop:

1. ASSESS — identify gaps and risks
2. CONSULT — resolve uncertainty through exploration and human interaction
3. REFINE — commit resolved understanding into the plan
4. RE-ASSESS — verify that refinement actually removed risk
5. RESOLUTION VALIDATION — confirm issues are resolved by evidence
6. READINESS — declare readiness for Plan Mode
7. CLEANED — prepare for next cycle

---

## Process Dynamics

The process is not a single linear pass.

- CONSULT may involve multiple back-and-forth interactions with a human
- REFINE may occur incrementally as understanding stabilizes
- RE-ASSESS may return the process to CONSULT or REFINE if gaps remain
- There is no fixed number of passes

The process continues until readiness criteria are genuinely satisfied, not merely visited once.

---

## Phase 1: ASSESS

**Goal:** Identify all material uncertainty that would cause Plan Mode to guess.

### Responsibilities

- Identify requirement gaps
- Identify code-context gaps
- Identify pattern alignment issues
- Identify contract risks
- Identify abstraction risks
- When a meaningful change appears necessary, create or update a Proposed Change entry instead of silently carrying the implication forward

### Code Coverage Check

- What code locations could affect or contradict assumptions?
- Have they been inspected?
- Are they recorded in Code Context?

If not → NOT READY

### Failure Mode Check (ASSESS)

Before completing ASSESS:

- Did I replace a question with a plausible answer? (Phantom Resolution)
- Did I treat a possibly non-local effect as local? (Materiality Minimization)
- Did I assume behavior without inspecting code?
- Did I describe behavior without grounding it structurally?

If yes or uncertain → continue assessing

---

## Phase 2: CONSULT

**Goal:** Resolve uncertainty through exploration, inspection, and human interaction.

### Responsibilities

- Answer human questions about design options
- Inspect additional code as requested
- Compare alternative approaches
- Clarify whether uncertainties are material
- Identify new risks or gaps uncovered during exploration

### Proposed Changes in CONSULT

- Create or update Proposed Changes when new implications arise
- Discuss Proposed Changes with the human
- Revise proposals based on exploration and feedback
- Mark proposals as:
  - UNDER DISCUSSION
  - ACCEPTED
  - REJECTED
- Do not treat discussion or exploration as implicit acceptance

### Behavior

- Do not prematurely commit changes to the plan
- Do not treat exploration as resolution
- Surface uncertainty explicitly
- Explain what evidence would resolve uncertainty

---

## Phase 3: REFINE

**Goal:** Commit resolved understanding into the plan and constraints.

### Responsibilities

- Apply only reviewed changes
- Update canonical intent
- Align implementation with existing patterns
- Preserve scoped boundaries and deferrals
- Apply only Proposed Changes that have been explicitly ACCEPTED

### Proposed Changes Rules

All meaningful changes must appear in Proposed Changes before being applied.

Derived changes must state:

- what breaks without them
- alternatives considered

### Proposed Change Lifecycle

Proposed Changes follow a multi-phase lifecycle:

1. **PROPOSED**
   - A meaningful change is identified (typically during ASSESS or CONSULT)
2. **UNDER DISCUSSION**
   - The change is being explored, clarified, or revised during CONSULT
3. **ACCEPTED / REJECTED**
   - The change has been explicitly reviewed and decided during CONSULT
4. **APPLIED**
   - Accepted changes are committed during REFINE

Rules:
- Proposed Changes must be created as soon as a meaningful change becomes apparent
- Discussion does not imply acceptance
- Only ACCEPTED changes may be applied during REFINE

### Handling Pattern Extension

If extending an existing pattern:

State explicitly:

- why it is consistent OR
- why it may broaden the pattern

Do not silently extend patterns.

### Scoped Deferral Pattern

When deferring edge cases:

- declare explicitly out of scope
- define temporary handling
- create/update Parked Issue
- record in canonical intent

---

## Phase 4: RE-ASSESS

**Goal:** Verify that refinement actually removed risk.

### Responsibilities

- Re-evaluate all open issues
- Confirm ambiguity is actually removed
- Identify new risks introduced

---

## Phase 5: RESOLUTION VALIDATION

**Goal:** Ensure issues are resolved by evidence, not plausibility.

Before marking an issue RESOLVED:

- What ambiguity was eliminated?
- What concrete decision or inspection removed it?
- Where is it reflected?

Do not resolve via plausible description alone.

---

## Phase 6: READINESS

**Goal:** Ensure Plan Mode can execute without guessing.

### Readiness Standard

READY only if:

- no material uncertainty remains
- implementation is grounded in inspected code
- no open blocking issues remain

### Readiness Failure Check

Before declaring READY:

- What ambiguity is now eliminated?
- What is Plan Mode prevented from guessing?
- Are all relevant code locations inspected?
- Were any derived changes not reviewed?
- Is any uncertainty being ignored?
- Are any meaningful changes being applied that were not explicitly ACCEPTED?

If any answer unclear → NOT READY

### Convergence Requirement

Reaching READINESS requires:

- prior phases have converged, not merely been visited
- no active uncertainty remains that would benefit from further CONSULT or REFINE

---

## Phase 7: CLEANUP (CLEANED)

**Goal:** Prepare the prep document for reuse.

### Responsibilities

- Promote durable decisions
- Archive completed cycle
- Move deferred items to Parked Issues
- Clear active workspace

---

## Cross-Cutting: Parked Issues

Parked Issues may be created or updated during:

- ASSESS (non-blocking tangents)
- CONSULT (explored but deferred questions)
- REFINE (explicit scoping decisions)

They are not a phase, but a persistent record of intentionally deferred work.

Must include:

- stable ID
- dependencies
- revisit trigger

---

## Expected Behavior

- be explicit
- show evidence
- surface uncertainty
- prefer correctness over progress

