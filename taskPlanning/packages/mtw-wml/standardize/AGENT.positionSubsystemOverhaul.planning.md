# Position subsystem overhaul cleanup follow-up

Status: not started.

## Purpose

Track removal of the temporary Position missing-payload fallback (`{ x: 0, y: 0 }`) after Position subsystem behavior is reworked to support a safer long-term ingestion strategy.

## Context

- Temporary fallback is documented in:
  - [`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md)

## Scope

- Re-evaluate Position ingestion semantics for omitted payloads.
- Replace temporary coordinate default with a safer explicit strategy.
- Preserve strict rejection for malformed present payload values.

## Initial checklist

- [ ] Define target Position ingestion behavior and migration constraints.
- [ ] Update Position facet parsing implementation.
- [ ] Add regression tests for migration-safe behavior.
- [ ] Remove temporary-risk note once replacement behavior is deployed.
