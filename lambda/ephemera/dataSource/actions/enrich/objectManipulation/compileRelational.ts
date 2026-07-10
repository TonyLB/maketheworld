import internalCache from '../../../../internalCache'
import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandEstablishRelationResult,
} from '../../baseClasses'

import { catalogWithScope } from './catalogMerge'
import type { ManipulationFrame } from './manipulationFrame'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import { normalizeRelationSpan } from './normalizeRelationSpan'
import { resolveRelationalGrounding, type RelationalGroundingDeps } from './resolveRelationalGrounding'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    relationPhraseFromNormalized,
    selectRelationalFromPools,
} from './selectRelationalFromPools'

export type CompileRelationalDeps = RelationalGroundingDeps & {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileRelationalResult =
    | ParseCommandEstablishRelationResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

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
    const graph = await positionsReadDeps.getPositionGraph(frame.hostRoomId)
    const catalog = catalogWithScope(frame.roomObjectCatalog ?? [], 'room')
    const relation = norm.relation

    const selection = selectRelationalFromPools({
        subjectPool: grounding.subjectPool,
        targetPool: grounding.targetPool,
        operationKind: frame.operationKind,
        relation,
        catalog,
        dryRunContext: { positionGraph: graph },
        relationPhrase: relationPhraseFromNormalized(relation),
    })

    if (selection.type === 'error') {
        return { type: 'Error', errorMessage: selection.errorMessage }
    }
    if (selection.type === 'abstain') {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.reason,
        }
    }
    if (selection.type === 'consult') {
        return {
            type: 'Consult',
            alternatives: selection.alternatives.map(({ proposedCommand, objectId }) => ({
                proposedCommand,
                objectId,
            })),
            confidence: intentConfidence,
        }
    }

    return {
        type: 'EstablishRelation',
        operationKind: selection.operationKind,
        subjectId: selection.subjectId,
        targetId: selection.targetId,
        relationKind: selection.relation.kind,
        ...(selection.relation.type === 'custom'
            ? { relationLabel: selection.relation.relationLabel }
            : {}),
        hostRoomId: frame.hostRoomId,
        confidence: intentConfidence,
    }
}
