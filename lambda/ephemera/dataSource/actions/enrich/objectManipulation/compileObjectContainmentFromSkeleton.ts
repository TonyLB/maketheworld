import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandObjectContainmentResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverReferenceKeys } from './identifySkeletonSpans'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import { attemptDryRun, attemptSpanKeys, buildAttemptEnvironment, defaultPositionsReads, groundedObjectIdOf, proposeAttemptCandidates } from './attemptCandidates'
import type { CommandAttempt } from '../../commandAttempt'

export type CompileObjectContainmentFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    /** Plan's ungrounded attempt: its one position action is the containment `transferMembership` (ISS8203 slice 2). */
    attempt: CommandAttempt
    containment: 'On' | 'In'
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileObjectContainmentFromSkeletonDeps = IdentityStageDeps & {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileObjectContainmentFromSkeletonResult =
    | ParseCommandObjectContainmentResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

/**
 * Client wiring: `On`/`In` is a containment move carrying a containment argument, not a peer
 * relational edge, so it does not go through `compileRelationalFromSkeleton.ts`'s peer-relation
 * checks. It does share the producer, the per-command environment and the dry run (ISS8203
 * slice 2, `attemptCandidates.ts`). `PartOf` never reaches this function (parseCommand.ts still
 * hard-errors it before this point, per ND-4 in AGENT.nestedObjectLook.planning.md).
 *
 * The subject's current host is read from the environment, not from the command, since parse and
 * execution are not the same moment. Boundary edges are not expanded in this slice (slice 3 adds
 * them), so a move whose subject is lashed in its source host still fails at commit, as before.
 */
export async function compileObjectContainmentFromSkeleton(
    input: CompileObjectContainmentFromSkeletonInput,
    intentConfidence: number,
    deps: CompileObjectContainmentFromSkeletonDeps = {}
): Promise<CompileObjectContainmentFromSkeletonResult> {
    if (input.hostRoomId === undefined) {
        return { type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom }
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

    const proposed = proposeAttemptCandidates({
        command: input.command,
        attempts: [input.attempt],
        spanPools: identityResult.spanPools,
        catalog,
        noAssignmentReason: 'No combination of two distinct grounded objects produced a well-typed containment move',
    })
    if (!proposed.ok) {
        return { type: 'Abstain', confidence: intentConfidence, reason: proposed.reason }
    }
    const groundedCandidates = proposed.candidates

    const positionsReads = deps.positionsReadDeps ?? defaultPositionsReads()
    const roomGraph = await positionsReads.getLudicGraph(hostRoomId)
    const env = await buildAttemptEnvironment(groundedCandidates, hostRoomId, roomGraph, positionsReads)

    const selection = selectPlanTuple({
        candidates: groundedCandidates,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: (candidate) => attemptDryRun(candidate, env),
        toConsultAlternative: (candidate) => candidate.alternative,
    })

    if (selection.verdict === 'consult') {
        return {
            type: 'Consult',
            alternatives: selection.alternatives.map(({ proposedCommand, objectId }) => ({ proposedCommand, objectId })),
            confidence: intentConfidence,
        }
    }

    if (selection.verdict === 'abstain' || selection.verdict === 'error') {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.reason,
        }
    }

    if (selection.verdict === 'defer') {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.dryRun.reason ?? objectManipulationErrorMessages.noMatch,
        }
    }

    const { candidate } = selection
    const step = candidate.attempt.actions()[0]!.desiredResult
    if (step?.kind !== 'change' || step.primitive !== 'transferMembership') {
        throw new Error('compileObjectContainmentFromSkeleton: the selected candidate is not a containment move')
    }

    return {
        type: 'ObjectContainment',
        subjectId: groundedObjectIdOf(step.object),
        targetId: groundedObjectIdOf(step.to),
        hostId: hostRoomId,
        containment: input.containment,
        confidence: intentConfidence,
        attempt: candidate.attempt.toJSON(),
    }
}
