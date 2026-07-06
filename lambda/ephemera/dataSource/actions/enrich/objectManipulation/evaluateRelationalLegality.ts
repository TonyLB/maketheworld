import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { RelationalOperationKind } from '../../baseClasses'
import {
    edgesMatch,
    nodeHasRelationalEdge,
    type EphemeraPositionGraph,
    type HostRelationalEdge,
} from '../../../positions/positionGraph'
import type { NormalizedRelation } from './relationKind'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type RelationalLegalityInput = {
    operationKind: RelationalOperationKind
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    normalizedRelation: NormalizedRelation
    graph: EphemeraPositionGraph
}

export type RelationalLegalityOutcome =
    | { type: 'allow' }
    | { type: 'error'; errorMessage: string }

function proposedEdgeFromInput(input: RelationalLegalityInput): HostRelationalEdge {
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
    proposed: HostRelationalEdge,
    edges: readonly HostRelationalEdge[]
): HostRelationalEdge | undefined {
    return edges.find((edge) => edgesMatch(edge, proposed))
}

export function evaluateRelationalLegality(input: RelationalLegalityInput): RelationalLegalityOutcome {
    const objectIdsOnGraph = input.graph.objectIds
    if (!objectIdsOnGraph.has(input.subjectId) || !objectIdsOnGraph.has(input.targetId)) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.notOnHostGraph,
        }
    }

    const existingEdges = input.graph.relationalEdges
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
