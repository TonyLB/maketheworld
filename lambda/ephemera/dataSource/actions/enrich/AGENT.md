# `mtw.ephemera.actions/enrich`

## Role

`actions/enrich/` defines post-discrimination enrichment flows that transform intent-level parse outcomes into terminal `ParseCommandResult` payloads.

Current implementation:

- [`acmeOrder/`](./acmeOrder/) - enriches `AcmeOrderIntent` into terminal **`AcmeOrder`** lines (or **`ParseCommandErrorResult`** when the Coyote-wide object placement count exceeds the cap **before** any Acme enrich Bedrock call), including catalog validation details, affinity proposals, and **`stableKey`** proposals.

## Boundary

- **Input:** an intent-level outcome from `discriminateIntent` plus original command/context (for example **`occupiedStableKeys`** and enrich-model responses).
- **Output:** terminal parse payloads (for example **`AcmeOrder`**, or **`Error`** when the placement cap rejects enrich) or pass-through behavior handled by **`parseCommand`** orchestration.
- **Ownership:** enrich modules should stay focused on enrichment/normalization logic; `parseCommand` remains the orchestrator deciding when enrichment runs.

## Current files

- [`acmeOrder/index.ts`](./acmeOrder/index.ts) - placement-count guard, Bedrock **`invokeBedrockAcmeOrderEnrich`**, and wiring to **`finalizeAcmeOrderFromEnrich`**.
- [`acmeOrder/buildPrompt.ts`](./acmeOrder/buildPrompt.ts) - builds Bedrock enrich prompt parts.
- [`acmeOrder/interpretAndFinalize.ts`](./acmeOrder/interpretAndFinalize.ts) - interprets enrich output and finalizes **`ParseCommandAcmeOrderResult`**.
- [`acmeOrder/acmeOrderThinkingPersistence.ts`](./acmeOrder/acmeOrderThinkingPersistence.ts) - bootstrap / emit / finalize helpers for segment **`acmeOrderEnrich`** (`mtw.ephemera.actions` **`Thinking Result`** publisher).
- [`acmeOrder/index.ts`](./acmeOrder/index.ts) - when **`EnrichAcmeOrderDeps.messageBus`** is set: **`bootstrapAcmeOrderThinkingAtRunStart`** at entry, **`emitAcmeOrderThinkingResult`** on successful invoke+parse, **`finalizeAcmeOrderThinkingOnFailure`** on placement cap, invoke/parse failure, or uncaught error. **`parseCommandCore`** forwards **`ParseCommandDeps.messageBus`** only (no duplicate lifecycle).

## Notes

- Avoid importing `parseCommand` from enrich modules to prevent orchestration cycles.
- Shared pure helper types may live under `actions/enrich/` if future enrich branches need common contracts.
