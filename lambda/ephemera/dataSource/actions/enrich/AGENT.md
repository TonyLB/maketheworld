# `mtw.ephemera.actions/enrich`

## Role

`actions/enrich/` defines post-discrimination enrichment flows that transform intent-level parse outcomes into terminal `ParseCommandResult` payloads.

Current implementation:

- [`acmeOrder/`](./acmeOrder/) - enriches `AcmeOrderIntent` into terminal `AcmeOrder` lines, including catalog validation details, affinity proposals, and `stableKey` proposals.

## Boundary

- **Input:** an intent-level outcome from `discriminateIntent` plus original command/context (for example `occupiedStableKeys` and enrich-model responses).
- **Output:** terminal parse payloads (for example `AcmeOrder`) or pass-through behavior handled by `parseCommand` orchestration.
- **Ownership:** enrich modules should stay focused on enrichment/normalization logic; `parseCommand` remains the orchestrator deciding when enrichment runs.

## Current files

- [`acmeOrder/buildPrompt.ts`](./acmeOrder/buildPrompt.ts) - builds Bedrock enrich prompt parts.
- [`acmeOrder/interpretAndFinalize.ts`](./acmeOrder/interpretAndFinalize.ts) - interprets enrich output and finalizes `ParseCommandAcmeOrderResult`.

## Notes

- Avoid importing `parseCommand` from enrich modules to prevent orchestration cycles.
- Shared pure helper types may live under `actions/enrich/` if future enrich branches need common contracts.
