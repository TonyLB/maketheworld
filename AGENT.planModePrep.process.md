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

## Pressure Relief Principle

The agent must not populate a section solely because it exists.

Every section must support an explicit **intentional blank state**, indicating either:
- it is not yet in play for the current phase, or
- it has been evaluated and contains no material entries

Absence of content is not sufficient; blank sections must declare their status.

---

## Material Uncertainty Standard

### Definition: Material

A question, gap, or change is **material** if it would require Plan Mode to:

- invent architecture, contracts, or scope
- make a decision not already explicitly grounded in the prep artifact

Non-material details may be safely improvised during execution.

Resolving material uncertainty could affect:

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

0. INIT - establish prep artifact
1. ACTIVATE TASK - load cycle scope
2. ASSESS — identify gaps and risks
3. CONSULT — resolve uncertainty through exploration and human interaction
4. REFINE — commit resolved understanding into the plan
5. RE-ASSESS — verify that refinement actually removed risk
6. RESOLUTION VALIDATION — confirm issues are resolved by evidence
7. READINESS — declare readiness for Plan Mode
8. CLEANED — prepare for next cycle

---

## Process Dynamics

The process is not a single linear pass.

- CONSULT may involve multiple back-and-forth interactions with a human
- REFINE may occur incrementally as understanding stabilizes
- RE-ASSESS may return the process to CONSULT or REFINE if gaps remain
- There is no fixed number of passes

The process continues until readiness criteria are genuinely satisfied, not merely visited once.

---

## Phase 0: INIT (Establish Prep Artifact)

**Goal:**  
Create a new `.prep.md` artifact for the overall effort without inferring task-specific intent.

**Responsibilities:**
- Create the prep file conforming to the schema
- Populate only **effort-level, cross-cycle context**:
  - Prep Scope (A1)
  - Standing Constraints (A2)
  - Known Decisions (A5) *only if explicitly pre-existing*
- Optionally import Established Code Context (A3) only if:
  - It was previously inspected, and
  - Its validity is not assumed without verification
- Do **not** populate:
  - Proposed Changes (B0)
  - Canonical Intent (B3)
  - Open Issues (B5)
- Set Cycle Status (B2):
  - Phase = INIT or ASSESS
  - Readiness = NOT READY

**Failure Check:**
- Did I infer intent, architecture, or decisions from a tasklist or planning doc?
- Did I populate active-cycle sections without performing a cycle?

---

## Phase 1: ACTIVATE TASK (Load Cycle Scope)

**Goal:**  
Load a specific task into the active workspace without inferring conclusions.

**Responsibilities:**
- Populate Cycle Scope (B1):
  - Current task
  - In-scope / Out-of-scope boundaries
- Update Cycle Status (B2):
  - Phase = ASSESS
  - Readiness = NOT READY
- Seed Code Context (B4) with **NEEDED** items (not INSPECTED)
- Leave the following sections intentionally blank unless already grounded:
  - Proposed Changes (B0)
  - Canonical Intent (B3)
  - Resolved Issues (B6)

**Failure Check:**
- Did I convert the task description into assumed design or intent?
- Did I populate conclusions before performing ASSESS?

---

## Phase 2: ASSESS

**Goal:** Identify all material uncertainty that would cause Plan Mode to guess.

### Responsibilities

- Identify requirement gaps
- Identify code-context gaps
- Identify pattern alignment issues
- Identify contract risks
- Identify abstraction risks
- When a meaningful change appears necessary, create or update a Proposed Change entry instead of silently carrying the implication forward
- Open Issues (B5) should include **only material uncertainties**
- At READINESS:
  - All material uncertainties must be resolved
  - Remaining uncertainties must be explicitly non-material

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

## Phase 3: CONSULT

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

## Phase 4: REFINE

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

## Phase 5: RE-ASSESS

**Goal:** Verify that refinement actually removed risk.

### Responsibilities

- Re-evaluate all open issues
- Confirm ambiguity is actually removed
- Identify new risks introduced

---

## Phase 6: RESOLUTION VALIDATION

**Goal:** Ensure issues are resolved by evidence, not plausibility.

Before marking an issue RESOLVED:

- What ambiguity was eliminated?
- What concrete decision or inspection removed it?
- Where is it reflected?

Do not resolve via plausible description alone.

---

## Phase 7: READINESS

**Goal:** Ensure Plan Mode can execute without guessing.

### Readiness Standard

READY only if:

- no material uncertainty remains
- implementation is grounded in inspected code
- no open blocking issues remain

**Readiness is binary.**  
If any material uncertainty remains, the system is NOT READY.

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
- B5 should be empty or contain only explicitly non-material items

---

## Phase 8: CLEANUP (CLEANED)

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

