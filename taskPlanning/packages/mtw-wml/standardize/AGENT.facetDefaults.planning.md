# Facet payload defaults and tolerant parse fallback

Status: in progress. Next step: add and finalize broader missing-payload regression coverage.

## Purpose and scope

Track a task-scoped initiative to make facet parsing more fault-tolerant when incoming facet JSON omits `payload`, by defining explicit default behavior per facet type and applying parser fallback in a controlled way.

This file is temporary task tracking. Follow task-plan conventions in [`taskPlanning/AGENT.md`](../../../AGENT.md).

## Durable context links

- Standardization overview: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md)
- Facet model and implementation notes: [`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)
- Facet payload types and guards: [`packages/mtw-wml/ts/standardize/keys/facets/dataTypes/facet.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/dataTypes/facet.ts)
- Form constructor and NDJSON validation entry points: [`packages/mtw-wml/ts/standardize/index.ts`](../../../../packages/mtw-wml/ts/standardize/index.ts), [`packages/mtw-wml/ts/standardize/baseClasses.ts`](../../../../packages/mtw-wml/ts/standardize/baseClasses.ts)

## Working assumptions

- Exit, Mark, LensMark, and SituationRoom can support tolerant missing-payload handling with explicit defaults.
- Position can accept risky fallback behavior for now (expected subsystem overhaul), but must be clearly documented as an interim tradeoff.
- Tolerance should preserve existing edit algebra behavior (`merge`, `diff`, `invert`) and not broaden schema acceptance beyond missing `payload`.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md).
2. Read facet architecture and factory behavior in [`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md).
3. Review payload constructors for active facet families:
   - [`packages/mtw-wml/ts/standardize/keys/facets/exit.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/exit.ts)
   - [`packages/mtw-wml/ts/standardize/keys/facets/mark.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/mark.ts)
   - [`packages/mtw-wml/ts/standardize/keys/facets/lensMark.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/lensMark.ts)
   - [`packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/situationRoom.ts)
   - [`packages/mtw-wml/ts/standardize/keys/facets/position.ts`](../../../../packages/mtw-wml/ts/standardize/keys/facets/position.ts)

## Progress

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| 1 | Define default matrix by facet type | Complete | Approved defaults for Exit/Mark/LensMark/SituationRoom and temporary-risk Position fallback |
| 2 | Implement tolerant parse fallback | Pending | Keep behavior scoped to missing payload only |
| 3 | Add tests for legacy/malformed facet JSON | Pending | Constructor + NDJSON + merge paths |
| 4 | Validate downstream lambda/client behavior | Pending | Ensure no silent parse failures |
| 5 | Document interim Position tradeoff | Pending | Add explicit temporary-risk note |

## Approved default matrix

| Facet type | Proposed missing-payload fallback | Risk level | Rationale |
| --- | --- | --- | --- |
| Exit | `undefined` | Low | Already part of payload domain (`string | undefined`) |
| Mark | `""` | Low/Medium | Empty narrative is semantically valid |
| LensMark | `{}` | Low | Optional `default` field already supports empty object |
| SituationRoom | `{}` | Low | Payload fields are optional |
| Position | `{ x: 0, y: 0 }` | Medium/High | Not neutral semantically; accepted as temporary tradeoff until Position subsystem overhaul |

## Ratification note

- Matrix approval complete for this slice.
- Tolerance scope remains limited to facet objects that are otherwise valid but omit `payload`.
- Next slice starts at parser implementation in Recommended order line 62.

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

- [X] Finalize and approve per-facet default matrix.
  - [X] Confirm safe defaults for Exit, Mark, LensMark, SituationRoom.
  - [X] Confirm temporary-risk Position fallback policy and wording.
- [X] Implement parser tolerance for missing facet payload.
  - [X] Add normalization path that injects defaults before facet payload construction.
  - [X] Keep strict behavior for other malformed facet structures.
- [X] Add test coverage for missing-payload input.
  - [X] StandardForm constructor/NDJSON acceptance for legacy facet lines.
  - [X] Facet constructor/list behavior with absent payloads.
  - [X] Regression coverage for merge/diff/invert semantics.

Verification note: Added explicit regression tests proving missing-payload-origin facets preserve expected merge/diff/invert behavior at facet and StandardForm levels.
- [ ] Validate end-to-end behavior in active flows.
  - [ ] Authoring edit acceptance paths (client + lambda).
  - [ ] Conflict/error response behavior remains observable.
- [ ] Document and bound the Position risk.
  - [ ] Add explicit note in durable facet docs that Position fallback is temporary.
  - [ ] Create follow-up link for Position subsystem overhaul cleanup.

## Verification focus

- Parser acceptance checks for omitted `payload` facets in NDJSON and constructor inputs.
- No silent drop of edits when tolerant parsing is exercised.
- Existing valid facet payload handling remains unchanged.
- Add/merge/diff/invert operations continue to pass facet test suites.

## Input vs normative seam slice

- [X] Add and export shared `Override<T, R>` helper in a reusable standardize type utility location.
- [X] Keep `FacetListData` as normative and `FacetListInputData` as ingestion-only with explicit intent docs.
- [X] Add `StandardXInputData` variants for facet-bearing component data types (`Example`, `Guidance`, `Situation`, `Map`, `Room`, `Lens`).
- [X] Add explicit input guards (`isStandardComponentInputData`, `isStandardFormInput`) while preserving normative guards (`isStandardComponentData`, `isStandardForm`).
- [X] Rewire ingestion-only boundaries (`StandardForm` JSON/NDJSON intake and `isStandardNDJSONLine`) to input guards.
- [X] Update constructor/fromJSON typing for facet-bearing components to accept input variants while keeping `toJSON()` normative.
- [X] Add verification coverage that input guards accept missing facet payloads while normative guards reject them.
