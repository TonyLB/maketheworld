import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

export type ParseObjectManipulationEnrichPromptParts = {
    invariantPrefix: string
    dynamicSuffix: string
}

const INVARIANT_PREFIX = `You enrich player commands about manipulating scene objects in the current room.

Respond with a single JSON object only (no markdown fences, no commentary).

## disposition: atomic (v1 implemented: takeHold only)

Pick up / grab / take hold of a single in-room object:
{ "disposition": "atomic", "operationKind": "takeHold", "objectSpan": "<raw object string>" }

- objectSpan: single raw object noun phrase (articles stripped, trimmed).
- operationKind must be exactly "takeHold" for pick-up paraphrases.

## disposition: complex (terminal stub only)

Relational placement (put X on Y, tie A to B):
{ "disposition": "complex", "complexityClass": "relationalPlacement", "summary": "<optional>" }

Multiple objects or deltas in one line:
{ "disposition": "complex", "complexityClass": "multiObject", "summary": "<optional>" }

Recognized manipulation but no v1 atomic path (e.g. drop until later):
{ "disposition": "complex", "complexityClass": "unimplementedVerb", "summary": "<optional>" }

## Rules

- disposition is required: exactly "atomic" or "complex".
- When disposition is atomic, operationKind is required (v1: use "takeHold" for pick-up).
- When disposition is complex, complexityClass is required; operationKind is forbidden.
- Forbidden: objectId, targetId, host routing ids, graph deltas.
- Prefer atomic takeHold when the line is a simple pick-up of one in-room catalog object.
- Route put X on Y and multi-object relational lines to disposition complex.
`

export function buildParseObjectManipulationEnrichPrompt(
    command: string,
    options: {
        rawObjectSpans: readonly string[]
        catalog: readonly RoomInPlayObjectCatalogEntry[]
    }
): ParseObjectManipulationEnrichPromptParts {
    const catalogLabels = [...new Set(options.catalog.map(({ normalizedShortName }) => normalizedShortName))]
    const dynamicSuffix = [
        `Player command: ${command.trim()}`,
        `Classifier object spans: ${JSON.stringify([...options.rawObjectSpans])}`,
        `In-room object catalog (normalized shortNames): ${JSON.stringify(catalogLabels)}`,
        'Respond with JSON only.',
    ].join('\n')

    return {
        invariantPrefix: INVARIANT_PREFIX,
        dynamicSuffix,
    }
}
