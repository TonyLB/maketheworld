import type { ObjectManipulationCatalogEntry } from './catalogMerge'

export type ParseObjectManipulationEnrichPromptParts = {
    invariantPrefix: string
    dynamicSuffix: string
}

const IDENTITY_INVARIANT_PREFIX = `You ground a player object noun phrase to exactly one catalog object id.

Respond with a single JSON object only (no markdown fences, no commentary).

## Required response

{ "objectId": "OBJECT#..." }

- objectId must be exactly one id from the supplied catalog.
- Pick the best match for the span given the player command and catalog entries.
- If no catalog entry fits or more than one fits equally, still return your best single objectId.

## Forbidden fields

objectSpan, disposition, operationKind, complexityClass, targetId, host routing ids, graph deltas.
`

export function buildObjectManipulationIdentityPrompt(
    command: string,
    options: {
        rawObjectSpan: string
        catalog: readonly ObjectManipulationCatalogEntry[]
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
        'Respond with JSON only.',
    ].join('\n')

    return {
        invariantPrefix: IDENTITY_INVARIANT_PREFIX,
        dynamicSuffix,
    }
}
