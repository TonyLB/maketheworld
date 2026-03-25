# AGENT.planModePrep.schema.md (Second Draft - Aligned with Process v1.0)

**Companion:** [Plan Mode prep process](AGENT.planModePrep.process.md).

## Purpose

Canonical structure for prep artifacts driven by that process. Any `AGENT.planning.prep.md` artifact used by this workflow should conform to this schema.

---

## Initialization Rules

When a new prep artifact is created (INIT phase):

### A. Persistent Context

- **A1 Prep Scope**: Populate from known documents or problem framing
- **A2 Standing Constraints**: Populate only from explicit constraints
- **A3 Established Code Context**:  
  - Leave empty unless explicitly imported from previously inspected work
  - Must not be assumed without verification
- **A4 Parked Issues**: Empty
- **A5 Decisions Ledger**:  
  - Empty unless importing pre-existing, authoritative decisions

### B. Active Prep Workspace

- **B0 Proposed Changes**: INTENTIONALLY BLANK — NOT YET IN PLAY
- **B1 Cycle Scope**: Empty
- **B2 Cycle Status**:  
  - Phase = INIT or ASSESS  
  - Readiness = NOT READY
- **B3 Canonical Intent**: INTENTIONALLY BLANK — NOT YET IN PLAY
- **B4 Code Context**: INTENTIONALLY BLANK — NOT YET IN PLAY
- **B5 Open Issues**: INTENTIONALLY BLANK — NOT YET IN PLAY
- **B6 Resolved Issues**: INTENTIONALLY BLANK — NOT YET IN PLAY
- **B7 Pass History**: Optional initial entry

## Task Activation Rules (ACTIVATE TASK)

When starting a new task cycle:

- **B1 Cycle Scope**: Populate with current task and boundaries
- **B2 Cycle Status**:
  - Phase = ASSESS
  - Readiness = NOT READY
- **B4 Code Context**:
  - Seed relevant files as **NEEDED**, not INSPECTED
- **B0 / B3 / B6**:
  - Remain INTENTIONALLY BLANK unless grounded by prior cycles
- **B5 Open Issues**:
  - Should remain INTENTIONALLY BLANK unless material uncertainties are already explicitly known
  - Must not be populated by inference from the task description alone

## Intentional Blank States

Sections must not be left implicitly empty.  
They must explicitly declare their blank state using one of:

- **INTENTIONALLY BLANK — NOT YET IN PLAY**  
  This section is not yet applicable for the current phase.

- **INTENTIONALLY BLANK — NO MATERIAL ENTRIES**  
  This section has been evaluated and contains no material items.

This prevents the agent from inferring that content is missing or incomplete.

## Structural Overview (Aligned with Process Phases)

The following mapping shows the primary write targets for each phase.  
Most phases read broadly from both Persistent Context and Active Workspace, but should write primarily to the sections listed below.

- ASSESS → B5 Open Issues, B4 Code Context
- CONSULT → B0 Proposed Changes (discussion + status updates)
- REFINE → B3 Canonical Intent, planning updates
- RE-ASSESS → B5/B6 Issue transitions
- RESOLUTION VALIDATION → B6 Resolved Issues
- READINESS → B2 Status
- CLEANED → A-sections + C archive

---

# A. Persistent Context (Cross-Cycle)

## Invalidation Rule (Persistent Context)

Entries in A-sections (especially A3 and A5) must be actively maintained.

When prior context becomes incorrect:
- It must be explicitly updated, superseded, or marked invalid
- It must not silently persist once known to be outdated

## A1. Prep Scope

- Feature / effort
- Planning doc
- Tasklist doc

## A2. Standing Constraints

- Architecture constraints
- Required invariants
- Preferred patterns
- Discouraged patterns

## A3. Established Code Context


| Artifact | Why it matters | Notes |
| -------- | -------------- | ----- |

- **NEEDED** = expected to require inspection this cycle  
- **INSPECTED** = examined during the current cycle  

Previously known files must not be treated as INSPECTED without re-examination.


## A4. Parked Issues (Cross-Cutting)

Parked Issues may be created during ASSESS, CONSULT, or REFINE.  
  
Parked Issue IDs (only) should use stable, origin-anchored semantic slugs rather than numeric sequence IDs.  
These IDs are identifiers, not full current definitions of the issue.

### [PARKED-id]

- Origin
- Description
- Why parked
- Dependencies
- Revisit trigger

## A5. Decisions Ledger

### [DECISION-id]

- Decision
- Origin (REQUESTED / DERIVED / DISCOVERED / CORRECTIVE)
- Supersedes
- Rationale
- Implications

---

# B. Active Prep Workspace

## B0. Proposed Changes (Human Review Surface)

### [CHANGE-id]

- Type
- Origin
- Status:
  - PROPOSED
  - UNDER DISCUSSION
  - ACCEPTED
  - REJECTED
- Summary
- Rationale
- Alternatives
- Impact
- Requires explicit approval

Rules:

- All meaningful changes must be recorded here before application
- Only ACCEPTED changes may be applied in REFINE

---

## B1. Cycle Scope

- Current task
- In-scope
- Out-of-scope

---

## B2. Cycle Status

- Phase
- Readiness
- Confidence

---

## B3. Canonical Intent (REFINE Output)

- Intended behavior
- Implementation direction
- Allowed patterns
- Disallowed patterns
- Deferred items
- Linked parked issues

---

## B4. Code Context (ASSESS / CONSULT Evidence)


| Status    | Artifact | Why it matters |
| --------- | -------- | -------------- |
| INSPECTED | ...      | ...            |
| NEEDED    | ...      | ...            |


---

## B5. Open Issues (ASSESS Output)

### [ISSUE-id]

- Type
- Description
- Why it matters
- Blocking reason
- Next step

---

## B6. Resolved Issues (Validated)

### [ISSUE-id]

- Resolution
- Evidence
- Confidence

---

## B7. Pass History

### Pass N

- Phase
- Actions
- Issues added/resolved
- Changes proposed/updated
- Notes

---

# C. Archive

## [CYCLE-id]

- Scope
- Key outcomes
- Decisions
- Patterns established

---

# D. Readiness Criteria

READY when:

- No material uncertainty remains
- Code context is inspected
- All blocking issues resolved
- All applied changes are ACCEPTED

---

# E. Cleanup (CLEANED)

- Promote durable items to A
- Archive cycle
- Clear B sections

Invariant:

- B is empty
- A is updated
- C contains summary

