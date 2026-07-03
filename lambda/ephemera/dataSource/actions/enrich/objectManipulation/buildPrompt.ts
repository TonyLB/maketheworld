import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { objectTouchesExitEdgeOnGraph } from './membershipObservation'

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

const COMPLEXITY_INVARIANT_PREFIX = `You assess whether a grounded object manipulation is atomic or complex.

The object id is already resolved. Do not re-resolve identity or supply objectSpan.

Respond with a single JSON object only (no markdown fences, no commentary).

## disposition: atomic (v1 implemented: takeHold, drop)

Simple pick-up of the grounded object despite relational edges on its host:
{ "disposition": "atomic", "operationKind": "takeHold" }

Simple drop / release of a held object to the room despite relational edges on its host:
{ "disposition": "atomic", "operationKind": "drop" }

## disposition: complex (terminal stub only)

Relational placement (put X on Y, tie A to B):
{ "disposition": "complex", "complexityClass": "relationalPlacement", "summary": "<optional>" }

## Rules

- disposition is required: exactly "atomic" or "complex".
- When disposition is atomic, operationKind is required (v1: "takeHold" for pick-up, "drop" for release to room).
- When disposition is complex, complexityClass is required; operationKind is forbidden.
- Forbidden: objectId, objectSpan, targetId, host routing ids, graph deltas.
- Prefer complex relationalPlacement when exit edges imply relational manipulation.
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

function summarizeTouchingEdges(graph: PlayPositionGraph, objectId: EphemeraObjectId): string[] {
    const edges = graph.edges ?? []
    const summaries: string[] = []
    for (let i = 0; i < edges.length; i++) {
        if (objectTouchesExitEdgeOnGraph({ nodes: graph.nodes, edges: [edges[i]] }, objectId)) {
            summaries.push(`edge[${i}]`)
        }
    }
    return summaries
}

export function buildObjectManipulationComplexityPrompt(
    command: string,
    options: {
        objectId: EphemeraObjectId
        containers: readonly EphemeraMembershipHostId[]
        positionGraph?: PlayPositionGraph
    }
): ParseObjectManipulationEnrichPromptParts {
    const touchingEdges = options.positionGraph !== undefined
        ? summarizeTouchingEdges(options.positionGraph, options.objectId)
        : []
    const dynamicSuffix = [
        `Player command: ${command.trim()}`,
        `Grounded objectId: ${options.objectId}`,
        `Membership containers: ${JSON.stringify([...options.containers])}`,
        `Exit edges touching object: ${JSON.stringify(touchingEdges)}`,
        'Respond with JSON only.',
    ].join('\n')

    return {
        invariantPrefix: COMPLEXITY_INVARIANT_PREFIX,
        dynamicSuffix,
    }
}

/** @deprecated Use buildObjectManipulationComplexityPrompt or buildObjectManipulationIdentityPrompt */
export function buildParseObjectManipulationEnrichPrompt(
    command: string,
    options: {
        rawObjectSpans: readonly string[]
        catalog: readonly { normalizedShortName: string }[]
    }
): ParseObjectManipulationEnrichPromptParts {
    return buildObjectManipulationComplexityPrompt(command, {
        objectId: 'OBJECT#Unknown' as EphemeraObjectId,
        containers: [],
    })
}
