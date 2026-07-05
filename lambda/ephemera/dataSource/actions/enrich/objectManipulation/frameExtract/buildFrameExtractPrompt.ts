import type { ParseObjectManipulationEnrichPromptParts } from '../buildPrompt'
import { mergeObjectManipulationCatalogs, type ObjectManipulationCatalogEntry } from '../catalogMerge'
import type { ManipulationFrameBuildInput } from '../manipulationFrame'

const FRAME_EXTRACT_INVARIANT_PREFIX = `You extract a relational object manipulation frame from a player command.

Respond with a single JSON object only (no markdown fences, no commentary).

## Required response

{
  "subjectSpan": "<object being manipulated>",
  "targetSpan": "<object or surface the relation applies to>",
  "relationSpan": "<prepositional or relational phrase only>",
  "operationKind": "establishRelation" | "dissolveRelation"
}

- subjectSpan: the object the player is moving, placing, leaning, tying, etc.
- targetSpan: the other object or surface in the relation.
- relationSpan: the relation phrase only (examples: "on", "under", "against", "around", "off", "from").
- operationKind: "establishRelation" when the player is creating or changing a relation (put, place, lean, tie, etc.); "dissolveRelation" when removing an existing relation (take off, remove from, detach, etc.).

Use raw player-language spans. Do not return object ids or canonical names unless they appear in the command.

## Examples

Establish: "put broom on table" -> operationKind "establishRelation"
Dissolve: "take rope off crate" -> operationKind "dissolveRelation"
Dissolve: "remove cord from crate" -> operationKind "dissolveRelation"

## Forbidden fields

objectId, subjectId, targetId, relationKind, disposition, complexityClass, host routing ids, graph deltas.
`

export function buildManipulationFrameExtractPrompt(
    input: ManipulationFrameBuildInput
): ParseObjectManipulationEnrichPromptParts {
    const roomObjectCatalog = input.roomObjectCatalog ?? []
    const heldInventoryCatalog = input.heldInventoryCatalog ?? []
    const catalog: readonly ObjectManipulationCatalogEntry[] = mergeObjectManipulationCatalogs(
        roomObjectCatalog,
        heldInventoryCatalog
    )
    const catalogRows = catalog.map(({ objectId, normalizedShortName, catalogScope }) => ({
        objectId,
        normalizedShortName,
        catalogScope,
    }))
    const dynamicSuffix = [
        `Player command: ${input.command.trim()}`,
        `Classify object spans (hints only): ${JSON.stringify([...input.rawObjectSpans])}`,
        `Object catalog (context only; do not return ids): ${JSON.stringify(catalogRows)}`,
        'Respond with JSON only.',
    ].join('\n')

    return {
        invariantPrefix: FRAME_EXTRACT_INVARIANT_PREFIX,
        dynamicSuffix,
    }
}
