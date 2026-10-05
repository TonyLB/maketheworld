import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandObjectContainmentResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { CommandAttempt } from '../../commandAttempt'

import { complexErrorMessage } from './complexityClasses'
import { mergeObjectManipulationCatalogs } from './catalogMerge'
import { adjudicateDeferred } from '../../commandAttempt/adjudicate'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverReferenceKeys } from './identifySkeletonSpans'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import {
    attemptDryRun,
    attemptSpanKeys,
    buildAttemptEnvironment,
    defaultPositionsReads,
    expandAndAdjudicateCandidates,
    groundedObjectIdOf,
    proposeAttemptCandidates,
    type GroundedAttemptCandidate,
} from './attemptCandidates'
import type { TransferMembershipChange } from './plan/planStep'

export type CompileTransferFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    /** Plan's ungrounded attempt. Its primary action is the `transferMembership` (take, drop, or a containment move). */
    attempt: CommandAttempt
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileTransferFromSkeletonDeps = IdentityStageDeps & {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileTransferFromSkeletonResult =
    | ParseCommandObjectManipulationResult
    | ParseCommandObjectContainmentResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

/** The primary action's `transferMembership`, which Plan's templates always put last. */
const primaryTransfer = (attempt: CommandAttempt): TransferMembershipChange => {
    const actions = attempt.actions()
    const step = actions[actions.length - 1]?.desiredResult
    if (step?.kind !== 'change' || step.primitive !== 'transferMembership') {
        throw new Error('compileTransferFromSkeleton: the attempt does not end in a transferMembership')
    }
    return step
}

/**
 * The transfer route (ISS8203 slice 3): take, drop and containment (`put X on/in Y`) share one
 * producer, one shared dry run and one selection. A take or drop is a whole-object transfer with
 * no containment argument; its result is the membership arm. A containment move carries a
 * containment argument and returns the containment arm. Both get the same boundary Expansion,
 * exit-contact challenge and transfer preconditions, whichever template produced the attempt.
 *
 * A take or drop has no complexity fallback: a defer (a pending `Under` or exit challenge) is an
 * Abstain until the deferred adjudication tier judges it.
 */
export async function compileTransferFromSkeleton(
    input: CompileTransferFromSkeletonInput,
    intentConfidence: number,
    deps: CompileTransferFromSkeletonDeps = {}
): Promise<CompileTransferFromSkeletonResult> {
    const transfer = primaryTransfer(input.attempt)
    const isMembership = transfer.containment === undefined
    // A containment move with no room is refused as before; a membership move's room is its drop host.
    const failure = (reason: string): CompileTransferFromSkeletonResult => (isMembership
        ? { type: 'Error', errorMessage: reason }
        : { type: 'Abstain', confidence: intentConfidence, reason })

    if (input.hostRoomId === undefined) {
        return isMembership
            ? { type: 'Error', errorMessage: objectManipulationErrorMessages.noMembershipHost }
            : { type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom }
    }
    const hostRoomId = input.hostRoomId

    const catalog = mergeObjectManipulationCatalogs(
        input.roomObjectCatalog ?? [],
        input.heldInventoryCatalog ?? []
    )

    const identityResult = await runIdentityStageOverReferenceKeys(
        input.command,
        input.skeleton,
        attemptSpanKeys([input.attempt]),
        catalog,
        deps
    )
    if (identityResult.type === 'error') {
        return { type: 'Error', errorMessage: identityResult.errorMessage }
    }

    // BD-20 arity policy: a take or drop names one object. Composing more is unbuilt Plan-IR work.
    if (isMembership && input.skeleton.filter((token) => token.type === 'objectSpan').length > 1) {
        return { type: 'Error', errorMessage: complexErrorMessage('multiObject') }
    }

    const proposed = proposeAttemptCandidates({
        command: input.command,
        attempts: [input.attempt],
        spanPools: identityResult.spanPools,
        catalog,
        noAssignmentReason: isMembership
            ? objectManipulationErrorMessages.noMatch
            : 'No combination of two distinct grounded objects produced a well-typed containment move',
    })
    if (!proposed.ok) {
        return failure(proposed.reason)
    }

    const positionsReads = deps.positionsReadDeps ?? defaultPositionsReads()
    const roomGraph = await positionsReads.getLudicGraph(hostRoomId)
    const env = await buildAttemptEnvironment(proposed.candidates, hostRoomId, roomGraph, positionsReads)
    const candidates = expandAndAdjudicateCandidates(proposed.candidates, env)
    const dryRun = (candidate: GroundedAttemptCandidate) => attemptDryRun(candidate, env, {
        roomId: hostRoomId,
        actorCharacterId: input.characterId,
    })
    const select = (pool: readonly GroundedAttemptCandidate[]) => selectPlanTuple({
        candidates: pool,
        getConfidence: (candidate) => candidate.confidence,
        dryRun,
        toConsultAlternative: (candidate) => candidate.alternative,
    })

    let selection = select(candidates)
    if (selection.verdict === 'defer') {
        // The deferred tier runs once, on the top deferred candidate, and re-validates only what it changed.
        const deferred = selection.candidate
        const judged = adjudicateDeferred(deferred, { roomId: hostRoomId })
        if (judged !== deferred) {
            selection = select(candidates.map((candidate) => (candidate === deferred ? judged : candidate)))
        }
    }

    if (selection.verdict === 'consult') {
        return {
            type: 'Consult',
            alternatives: selection.alternatives.map(({ proposedCommand, objectId }) => ({ proposedCommand, objectId })),
            confidence: intentConfidence,
        }
    }

    if (selection.verdict === 'abstain') {
        return { type: 'Abstain', confidence: intentConfidence, reason: selection.reason }
    }

    if (selection.verdict === 'error') {
        return failure(selection.reason)
    }

    if (selection.verdict === 'defer') {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.dryRun.reason ?? objectManipulationErrorMessages.noMatch,
        }
    }

    const { candidate } = selection
    const step = primaryTransfer(candidate.attempt)
    const objectId = groundedObjectIdOf(step.object)
    if (!isEphemeraObjectId(objectId)) {
        throw new Error('compileTransferFromSkeleton: the selected transfer moves a non-Object')
    }

    if (isMembership) {
        return {
            type: 'ObjectManipulation',
            operationKind: step.to.referentType === 'actingCharacter' ? 'takeHold' : 'drop',
            objectIds: [objectId],
            confidence: intentConfidence,
            attempt: candidate.attempt.toJSON(),
        }
    }

    return {
        type: 'ObjectContainment',
        subjectId: objectId,
        targetId: groundedObjectIdOf(step.to),
        hostId: hostRoomId,
        containment: step.containment!,
        confidence: intentConfidence,
        attempt: candidate.attempt.toJSON(),
    }
}
