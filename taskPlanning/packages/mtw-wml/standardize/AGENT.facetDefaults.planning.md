# Facet payload defaults and tolerant parse fallback

Status: not started. Next step: inventory all facet payload types and define per-type default safety policy before changing parser behavior.

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
| 1 | Define default matrix by facet type | Pending | Include risk notes for Position |
| 2 | Implement tolerant parse fallback | Pending | Keep behavior scoped to missing payload only |
| 3 | Add tests for legacy/malformed facet JSON | Pending | Constructor + NDJSON + merge paths |
| 4 | Validate downstream lambda/client behavior | Pending | Ensure no silent parse failures |
| 5 | Document interim Position tradeoff | Pending | Add explicit temporary-risk note |

## Default matrix to ratify

| Facet type | Proposed missing-payload fallback | Risk level | Rationale |
| --- | --- | --- | --- |
| Exit | `undefined` | Low | Already part of payload domain (`string | undefined`) |
| Mark | `""` | Low/Medium | Empty narrative is semantically valid |
| LensMark | `{}` | Low | Optional `default` field already supports empty object |
| SituationRoom | `{}` | Low | Payload fields are optional |
| Position | `{ x: 0, y: 0 }` | Medium/High | Not neutral semantically; accepted as temporary tradeoff |

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

- [ ] Finalize and approve per-facet default matrix.
  - [ ] Confirm safe defaults for Exit, Mark, LensMark, SituationRoom.
  - [ ] Confirm temporary-risk Position fallback policy and wording.
- [ ] Implement parser tolerance for missing facet payload.
  - [ ] Add normalization path that injects defaults before facet payload construction.
  - [ ] Keep strict behavior for other malformed facet structures.
- [ ] Add test coverage for missing-payload input.
  - [ ] StandardForm constructor/NDJSON acceptance for legacy facet lines.
  - [ ] Facet constructor/list behavior with absent payloads.
  - [ ] Regression coverage for merge/diff/invert semantics.
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
