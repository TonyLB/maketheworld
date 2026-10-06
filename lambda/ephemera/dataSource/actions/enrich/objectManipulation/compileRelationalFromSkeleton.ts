import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandCommandAttemptResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverReferenceKeys } from './identifySkeletonSpans'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import { attemptDryRun, attemptSpanKeys, buildAttemptEnvironment, defaultPositionsReads, groundedObjectIdOf, proposeAttemptCandidates, type GroundedAttemptCandidate } from './attemptCandidates'
import type { ExecutorOutputStep, ExecutorRelationalChain } from './synthesize/executorTypes'
import { lowerRelationalChain } from './synthesize/buildCrossingLegs'
import type { CommandAttempt } from '../../commandAttempt'

export type CompileRelationalFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    /** Plan's ungrounded attempt: its one position action's step is the relation (ISS8203 slice 1). */
    attempt: CommandAttempt
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileRelationalFromSkeletonDeps = IdentityStageDeps & {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileRelationalFromSkeletonResult =
    | ParseCommandCommandAttemptResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

/**
 * The native relational pipeline (see AGENT.md, relational branch, and
 * ../../AGENT.concepts.md's Parse/Plan/Synthesize decomposition): Plan's attempt -> Identify
 * (runIdentityStageOverReferenceKeys) -> the shared producer (`attemptCandidates.ts`: joint
 * assignments, grounding and description) -> the per-command environment -> the shared dry run
 * (the executor's Expansion finds the chain, which the kernel rechecks at commit) -> selection.
 * This function keeps the route's entry checks and maps the selected candidate onto its result arm.
 *
 * A candidate whose Expansion finds no chain, or whose chain leads with a hosting kind, is
 * illegal. `defer` has no Consult/LLM-fallback path on this route (unlike membership), so it
 * abstains.
 */
export async function compileRelationalFromSkeleton(
    input: CompileRelationalFromSkeletonInput,
    intentConfidence: number,
    deps: CompileRelationalFromSkeletonDeps = {}
): Promise<CompileRelationalFromSkeletonResult> {
    const change = input.attempt.actions()[0]?.desiredResult
    if (change?.kind !== 'change' || (change.primitive !== 'establishRelation' && change.primitive !== 'dissolveRelation')) {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: objectManipulationErrorMessages.relationalNoTemplateMatch,
        }
    }

    if (input.hostRoomId === undefined || input.characterId === undefined) {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        }
    }
    const hostRoomId = input.hostRoomId

    const positionsReads = deps.positionsReadDeps ?? defaultPositionsReads()
    const roomGraph = await positionsReads.getLudicGraph(hostRoomId)
    if (!roomGraph) {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        }
    }

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

    if (change.relationKind === 'In' || change.relationKind === 'PartOf' || change.relationKind === 'On') {
        // isContainmentSpan routes hosting kinds to the containment producer before a Change reaches here.
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: 'Containment relation kinds are not yet groundable as establishRelation/dissolveRelation steps',
        }
    }

    const proposed = proposeAttemptCandidates({
        command: input.command,
        attempts: [input.attempt],
        spanPools: identityResult.spanPools,
        catalog,
        noAssignmentReason: 'No combination of two distinct grounded objects produced a well-typed establishRelation/dissolveRelation step',
    })
    if (!proposed.ok) {
        return { type: 'Abstain', confidence: intentConfidence, reason: proposed.reason }
    }
    const groundedCandidates = proposed.candidates

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
        // This route has no complexity LLM to hand a `defer` candidate to (unlike membership) ---
        // it abstains instead of re-grounding, same family as today.
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.dryRun.reason ?? 'No relational candidate in the pool found a chain',
        }
    }

    return relationalResult(selection.candidate, intentConfidence)
}

/**
 * Maps the selected candidate onto the attempt arm (ISS8203 slice 4). The attempt carries the
 * grounded relation; the kernel steps are no longer on the result (commit lowers the attempt).
 */
const relationalResult = (
    candidate: GroundedAttemptCandidate,
    intentConfidence: number
): ParseCommandCommandAttemptResult => {
    const step = candidate.attempt.actions()[0]!.desiredResult
    if (step?.kind !== 'change' || (step.primitive !== 'establishRelation' && step.primitive !== 'dissolveRelation')) {
        throw new Error('compileRelationalFromSkeleton: the selected candidate is not a relation step')
    }
    if (step.relationKind === 'In' || step.relationKind === 'PartOf' || step.relationKind === 'On') {
        // Abstained before the producer runs (see compileRelationalFromSkeleton's entry checks).
        throw new Error('compileRelationalFromSkeleton: a containment kind reached the relational result')
    }
    return {
        type: 'CommandAttempt',
        attempt: candidate.attempt.toJSON(),
        confidence: intentConfidence,
    }
}
