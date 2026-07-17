import type { ParseObjectManipulationEnrichPromptParts } from '../buildPrompt'
import type { ObjectManipulationCatalogEntry } from '../catalogMerge'

const IDENTITY_ONLY_FALLBACK_INVARIANT_PREFIX = `You ground a player object noun phrase to catalog object ids, ranked by confidence.

The intended operation on this object is already resolved --- do not re-resolve it.

Respond with a single JSON object only (no markdown fences, no commentary).

## Required response

{ "candidates": [{ "objectId": "OBJECT#...", "confidence": 0.0 }, ...] }

- Every objectId must be exactly one id from the supplied catalog.
- List candidates ordered from most to least likely match for the span.
- confidence is your own estimate in [0, 1] of how likely this candidate is the intended object.
- Include every catalog entry that is plausibly the intended object; omit ones that clearly are not.

## Forbidden fields

operationKind, disposition, complexityClass, targetId, host routing ids, graph deltas.
`

export function buildIdentityOnlyFallbackPrompt(
    command: string,
    options: {
        rawObjectSpan: string
        catalog: readonly ObjectManipulationCatalogEntry[]
        operationKind: 'takeHold' | 'drop'
    }
): ParseObjectManipulationEnrichPromptParts {
    const catalogRows = options.catalog.map(({ objectId, normalizedShortName, catalogScope }) => ({
        objectId,
        normalizedShortName,
        catalogScope,
    }))
    const dynamicSuffix = [
        `Player command: ${command.trim()}`,
        `Object span to ground: ${JSON.stringify(options.rawObjectSpan)}`,
        `Object catalog: ${JSON.stringify(catalogRows)}`,
        `Already-resolved operationKind: ${options.operationKind}`,
        'Respond with JSON only.',
    ].join('\n')

    return {
        invariantPrefix: IDENTITY_ONLY_FALLBACK_INVARIANT_PREFIX,
        dynamicSuffix,
    }
}
