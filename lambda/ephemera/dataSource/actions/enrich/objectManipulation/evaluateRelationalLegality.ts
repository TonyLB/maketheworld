import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import type { RelationalOperationKind } from '../../baseClasses'
import type { NormalizedRelation } from './relationKind'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    edgesMatch,
    extractObjectIdsOnHostGraph,
    extractRelationalEdgesFromPlayPositionGraph,
    nodeHasRelationalEdge,
    type ObservedHostRelationalEdge,
} from './relationalObservation'

export type RelationalLegalityInput = {
    operationKind: RelationalOperationKind
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    normalizedRelation: NormalizedRelation
    positionGraph: PlayPositionGraph
}

export type RelationalLegalityOutcome =
    | { type: 'allow' }
    | { type: 'error'; errorMessage: string }

function proposedEdgeFromInput(input: RelationalLegalityInput): ObservedHostRelationalEdge {
    const relationLabel = input.normalizedRelation.type === 'custom'
        ? input.normalizedRelation.relationLabel
        : undefined
    return {
        from: input.subjectId,
        to: input.targetId,
        kind: input.normalizedRelation.kind,
        ...(relationLabel !== undefined ? { relationLabel } : {}),
    }
}

function findMatchingEdge(
    proposed: ObservedHostRelationalEdge,
    edges: readonly ObservedHostRelationalEdge[]
): ObservedHostRelationalEdge | undefined {
    return edges.find((edge) => edgesMatch(edge, proposed))
}

export function evaluateRelationalLegality(input: RelationalLegalityInput): RelationalLegalityOutcome {
    const objectIdsOnGraph = new Set(extractObjectIdsOnHostGraph(input.positionGraph))
    if (!objectIdsOnGraph.has(input.subjectId) || !objectIdsOnGraph.has(input.targetId)) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.notOnHostGraph,
        }
    }

    const existingEdges = extractRelationalEdgesFromPlayPositionGraph(input.positionGraph)
    const proposed = proposedEdgeFromInput(input)
    const exactMatch = findMatchingEdge(proposed, existingEdges)

    if (input.operationKind === 'dissolveRelation') {
        if (exactMatch === undefined) {
            return {
                type: 'error',
                errorMessage: objectManipulationErrorMessages.dissolveNoMatchingEdge,
            }
        }
        return { type: 'allow' }
    }

    if (exactMatch !== undefined) {
        return { type: 'allow' }
    }

    const subjectHasOtherEdges = nodeHasRelationalEdge(input.subjectId, existingEdges)
    const targetHasOtherEdges = nodeHasRelationalEdge(input.targetId, existingEdges)
    if (subjectHasOtherEdges || targetHasOtherEdges) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        }
    }

    return { type: 'allow' }
}
