import internalCache from '../../../../internalCache'
import type {
    ParseCommandErrorResult,
    ParseCommandEstablishRelationResult,
} from '../../baseClasses'

import type { ManipulationFrame } from './manipulationFrame'
import { evaluateRelationalLegality } from './evaluateRelationalLegality'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import { normalizeRelationSpan } from './normalizeRelationSpan'
import { resolveRelationalGrounding, type RelationalGroundingDeps } from './resolveRelationalGrounding'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type CompileRelationalDeps = RelationalGroundingDeps & {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileRelationalResult = ParseCommandEstablishRelationResult | ParseCommandErrorResult

const defaultPositionsReadDeps = (): ObjectManipulationPositionsReadDeps => ({
    getMembershipContainers: (objectId) => internalCache.Positions.getMembershipContainers(objectId),
    getPositionGraph: (hostId) => internalCache.Positions.getPositionGraph(hostId),
})

export async function compileRelational(
    frame: ManipulationFrame,
    intentConfidence: number,
    deps: CompileRelationalDeps = {}
): Promise<CompileRelationalResult> {
    const norm = normalizeRelationSpan(frame.relationSpan)
    if (norm.type === 'nestingDefer') {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        }
    }

    if (frame.hostRoomId === undefined) {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        }
    }

    const grounding = await resolveRelationalGrounding(
        frame.command,
        frame.subjectSpan,
        frame.targetSpan,
        frame.roomObjectCatalog,
        deps
    )
    if (grounding.type === 'error') {
        return { type: 'Error', errorMessage: grounding.errorMessage }
    }

    const positionsReadDeps = deps.positionsReadDeps ?? defaultPositionsReadDeps()
    const positionGraph = await positionsReadDeps.getPositionGraph(frame.hostRoomId)

    const legality = evaluateRelationalLegality({
        operationKind: frame.operationKind,
        subjectId: grounding.subjectId,
        targetId: grounding.targetId,
        normalizedRelation: norm.relation,
        positionGraph,
    })
    if (legality.type === 'error') {
        return { type: 'Error', errorMessage: legality.errorMessage }
    }

    const relation = norm.relation
    return {
        type: 'EstablishRelation',
        operationKind: frame.operationKind,
        subjectId: grounding.subjectId,
        targetId: grounding.targetId,
        relationKind: relation.kind,
        ...(relation.type === 'custom' ? { relationLabel: relation.relationLabel } : {}),
        hostRoomId: frame.hostRoomId,
        confidence: intentConfidence,
    }
}
