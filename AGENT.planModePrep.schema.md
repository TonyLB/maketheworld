# AGENT.planModePrep.schema.md (Second Draft - Aligned with Process v1.0)

**Companion:** [Plan Mode prep process](AGENT.planModePrep.process.md).

## Purpose

Canonical structure for prep artifacts driven by that process. Any `AGENT.planning.prep.md` artifact used by this workflow should conform to this schema.

---

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

