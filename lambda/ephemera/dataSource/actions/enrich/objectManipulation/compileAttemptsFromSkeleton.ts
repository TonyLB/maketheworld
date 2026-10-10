import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandCommandAttemptResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { CommandAttempt } from '../../commandAttempt'
import { NarrateAttemptAction } from '../../commandAttempt/action'

import { complexErrorMessage } from './complexityClasses'
import { mergeObjectManipulationCatalogs } from './catalogMerge'
import { adjudicateDeferred } from '../../commandAttempt/adjudicate'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverReferenceKeys } from './identifySkeletonSpans'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { ParseSkeleton } from './parse/parseToken'
import type { TransferMembershipChange } from './plan/planStep'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import { applyChallengeAnswers, primaryActionIdOf, resumeErrorMessages, type ResumeAnswers } from './resumeAnswers'
import {
    attemptDryRun,
    attemptReferentAnswers,
    attemptSkeletonLabel,
    attemptSpanKeys,
    buildAttemptEnvironment,
    defaultPositionsReads,
    expandAndAdjudicateCandidates,
    groundedObjectIdOf,
    proposeAttemptCandidates,
    type GroundedAttemptCandidate,
} from './attemptCandidates'

export type CompileAttemptsFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    /** Plan's ungrounded attempts, all of them (ISS8203 slice 4). The caller routes the zero-attempt case. */
    attempts: readonly CommandAttempt[]
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    /** A resumed command's stored answers (`persistentCommand/resume.ts`); absent on a first run. */
    answers?: ResumeAnswers
}

export type CompileAttemptsFromSkeletonDeps = IdentityStageDeps & {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileAttemptsFromSkeletonResult =
    | ParseCommandCommandAttemptResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

/** What an attempt is, by its own content: a look, a take or drop, a containment move, or a relation. */
type AttemptKind = 'look' | 'membership' | 'containment' | 'relation'

type AttemptEntry = {
    attempt: CommandAttempt
    kind: AttemptKind
}

/** The primary action's `transferMembership`, which Plan's templates always put last (take, drop, containment). */
const transferOf = (attempt: CommandAttempt): TransferMembershipChange | undefined => {
    const actions = attempt.actions()
    const step = actions[actions.length - 1]?.desiredResult
    return step?.kind === 'change' && step.primitive === 'transferMembership' ? step : undefined
}

const kindOf = (attempt: CommandAttempt): AttemptKind => {
    // A look is a narration action. An attempt with no actions is a look too, as parseCommand has always routed it.
    if (attempt.actions().every((action) => action instanceof NarrateAttemptAction)) {
        return 'look'
    }
    const transfer = transferOf(attempt)
    if (transfer === undefined) {
        return 'relation'
    }
    return transfer.containment === undefined ? 'membership' : 'containment'
}

/** A refusal is an Error for a take or drop, and an Abstain for every other kind (as each route always has). */
const refusal = (kind: AttemptKind, reason: string, intentConfidence: number): CompileAttemptsFromSkeletonResult => (kind === 'membership'
    ? { type: 'Error', errorMessage: reason }
    : { type: 'Abstain', confidence: intentConfidence, reason })

/**
 * An attempt's entry checks, before Identify: the ones that need no spans. Each attempt is judged
 * on its own kind, so one attempt's refusal never decides another's (ISS8203 slice 4.5).
 */
const preIdentityRefusal = (entry: AttemptEntry, input: CompileAttemptsFromSkeletonInput, intentConfidence: number): CompileAttemptsFromSkeletonResult | undefined => {
    const { attempt, kind } = entry
    if (kind === 'look') {
        if (attempt.actions()[0]?.referents()[0] === undefined) {
            return refusal(kind, objectManipulationErrorMessages.lookNoTemplateMatch, intentConfidence)
        }
        if (input.characterId === undefined) {
            return { type: 'Error', errorMessage: objectManipulationErrorMessages.noActingCharacter }
        }
        return undefined
    }
    if (kind === 'membership' || kind === 'containment') {
        if (input.hostRoomId === undefined) {
            return kind === 'membership'
                ? { type: 'Error', errorMessage: objectManipulationErrorMessages.noMembershipHost }
                : { type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom }
        }
        return undefined
    }
    if (input.hostRoomId === undefined || input.characterId === undefined) {
        return { type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom }
    }
    return undefined
}

/**
 * An attempt's checks after Identify, which need its spans resolved: a relation's containment kind,
 * and a look's referent carrying a stableRefKey.
 */
const postIdentityRefusal = (entry: AttemptEntry, intentConfidence: number): CompileAttemptsFromSkeletonResult | undefined => {
    const { attempt, kind } = entry
    if (kind === 'look') {
        const lookedAt = attempt.actions()[0]?.referents()[0]
        if (lookedAt?.referentType !== 'objectSpan' || lookedAt.stableRefKey === undefined) {
            return { type: 'Abstain', confidence: intentConfidence, reason: `${lookedAt?.referentType} referent has no stableRefKey to resolve against` }
        }
        return undefined
    }
    if (kind === 'relation') {
        // isContainmentSpan routes hosting kinds to the containment producer before a Change reaches here.
        const relation = attempt.actions()[0]?.desiredResult
        if (relation?.kind === 'change' && (relation.primitive === 'establishRelation' || relation.primitive === 'dissolveRelation')
            && (relation.relationKind === 'In' || relation.relationKind === 'PartOf' || relation.relationKind === 'On')) {
            return {
                type: 'Abstain',
                confidence: intentConfidence,
                reason: 'Containment relation kinds are not yet groundable as establishRelation/dissolveRelation steps',
            }
        }
    }
    return undefined
}

const noAssignmentReasonFor = (kind: AttemptKind): string => {
    switch (kind) {
        case 'look': return 'No object candidate in the pool resolved to a describable referent'
        case 'membership': return objectManipulationErrorMessages.noMatch
        case 'relation': return 'No combination of two distinct grounded objects produced a well-typed establishRelation/dissolveRelation step'
        case 'containment': return 'No combination of two distinct grounded objects produced a well-typed containment move'
    }
}

/**
 * The one producer for Plan's attempts (ISS8203 slices 2-4, and 4.5's per-attempt entry): relational,
 * transfer (take, drop and containment) and look share one Identify, one producer, one environment,
 * one dry run and one selection.
 *
 * Each attempt is classified by its own content and gated by its own entry checks. A refused attempt
 * drops out of the pool with its own refusal; the survivors pool together. A refusal is returned only
 * when nothing survives: the first one, in Plan's order. Once the pool has a survivor, the result is
 * the pool's, and its refusal wording and style come from the first surviving attempt.
 *
 * A take or drop has no complexity fallback: a defer (a pending peer-move or exit challenge) is an
 * Abstain until the deferred adjudication tier judges it. A relation whose Expansion finds no chain
 * is illegal, and it abstains on defer (no LLM fallback on that route).
 */
export async function compileAttemptsFromSkeleton(
    input: CompileAttemptsFromSkeletonInput,
    intentConfidence: number,
    deps: CompileAttemptsFromSkeletonDeps = {}
): Promise<CompileAttemptsFromSkeletonResult> {
    if (input.attempts.length === 0) {
        throw new Error('compileAttemptsFromSkeleton: no attempts (the caller routes the no-object case)')
    }
    const hostRoomId = input.hostRoomId
    const answers = input.answers
    // A resumed command's chosen plan narrows the frozen attempts; one no longer among them is stale.
    const attempts = answers?.selectedAttempt === undefined
        ? input.attempts
        : input.attempts.filter((attempt) => primaryActionIdOf(attempt) === answers.selectedAttempt)
    if (attempts.length === 0) {
        return { type: 'Error', errorMessage: resumeErrorMessages.staleSelectedAttempt }
    }
    const refusals: CompileAttemptsFromSkeletonResult[] = []

    // Pre-Identify: each attempt's own refusal, then the survivors.
    let survivors: AttemptEntry[] = []
    for (const attempt of attempts) {
        const entry: AttemptEntry = { attempt, kind: kindOf(attempt) }
        const refused = preIdentityRefusal(entry, input, intentConfidence)
        if (refused) {
            refusals.push(refused)
        } else {
            survivors.push(entry)
        }
    }
    if (survivors.length === 0) {
        return refusals[0]!
    }

    // A relation needs the room graph, read once for the pool's environment; a relation without one is refused.
    const positionsReads = deps.positionsReadDeps ?? defaultPositionsReads()
    const roomGraph = hostRoomId !== undefined && survivors.some((entry) => entry.kind !== 'look')
        ? await positionsReads.getLudicGraph(hostRoomId)
        : undefined
    survivors = survivors.filter((entry) => {
        if (entry.kind === 'relation' && roomGraph === undefined) {
            refusals.push({ type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom })
            return false
        }
        return true
    })
    if (survivors.length === 0) {
        return refusals[0]!
    }

    const catalog = mergeObjectManipulationCatalogs(
        input.roomObjectCatalog ?? [],
        input.heldInventoryCatalog ?? []
    )

    const identityResult = await runIdentityStageOverReferenceKeys(
        input.command,
        input.skeleton,
        attemptSpanKeys(survivors.map((entry) => entry.attempt)),
        catalog,
        deps
    )
    if (identityResult.type === 'error') {
        return { type: 'Error', errorMessage: identityResult.errorMessage }
    }

    // BD-20 arity policy: a take or drop names one object. Composing more is unbuilt Plan-IR work.
    if (survivors.some((entry) => entry.kind === 'membership') && input.skeleton.filter((token) => token.type === 'objectSpan').length > 1) {
        return { type: 'Error', errorMessage: complexErrorMessage('multiObject') }
    }

    // Post-Identify: each survivor's own refusal, then the survivors again.
    survivors = survivors.filter((entry) => {
        const refused = postIdentityRefusal(entry, intentConfidence)
        if (refused) {
            refusals.push(refused)
            return false
        }
        return true
    })
    if (survivors.length === 0) {
        return refusals[0]!
    }

    // The pool's wording and style come from its first surviving attempt.
    const lead = survivors[0]!
    const failure = (reason: string): CompileAttemptsFromSkeletonResult => refusal(lead.kind, reason, intentConfidence)
    const proposed = proposeAttemptCandidates({
        command: input.command,
        attempts: survivors.map((entry) => entry.attempt),
        spanPools: identityResult.spanPools,
        catalog,
        noAssignmentReason: noAssignmentReasonFor(lead.kind),
        referentAnswers: answers?.referentAnswers,
    })
    if (!proposed.ok) {
        return proposed.stale ? { type: 'Error', errorMessage: proposed.reason } : failure(proposed.reason)
    }

    // A pool of looks has no steps, so the shared dry run never reads its environment and none is built.
    const env = roomGraph === undefined || hostRoomId === undefined || survivors.every((entry) => entry.kind === 'look')
        ? undefined
        : await buildAttemptEnvironment(proposed.candidates, hostRoomId, roomGraph, positionsReads)
    const expanded = env === undefined ? proposed.candidates : expandAndAdjudicateCandidates(proposed.candidates, env)
    const candidates = answers?.challengeAnswers === undefined ? expanded : applyChallengeAnswers(expanded, answers.challengeAnswers)
    const dryRun = (candidate: GroundedAttemptCandidate) => attemptDryRun(candidate, env, {
        roomId: hostRoomId,
        actorCharacterId: input.characterId,
    })
    const select = (pool: readonly GroundedAttemptCandidate[]) => selectPlanTuple({
        candidates: pool,
        getConfidence: (candidate) => candidate.confidence,
        dryRun,
        toConsultAlternative: (candidate) => ({
            ...candidate.alternative,
            label: attemptSkeletonLabel(input.skeleton, candidate.attempt),
            referentAnswers: attemptReferentAnswers(candidate.attempt),
        }),
    })

    let selection = select(candidates)
    if (selection.verdict === 'defer') {
        // The deferred tier runs once, on the top deferred candidate, and re-validates only what it changed.
        const deferred = selection.candidate
        const judged = adjudicateDeferred(deferred, { roomId: hostRoomId! })
        if (judged !== deferred) {
            selection = select(candidates.map((candidate) => (candidate === deferred ? judged : candidate)))
        }
    }

    if (selection.verdict === 'consult') {
        return {
            type: 'Consult',
            alternatives: selection.alternatives.map(({ proposedCommand, objectId, label, referentAnswers }) => ({ proposedCommand, objectId, label, referentAnswers })),
            confidence: intentConfidence,
            // All of Plan's attempts, not the survivors: a resume restarts from the same frozen set.
            root: {
                command: input.command,
                skeleton: input.skeleton,
                attempts: input.attempts.map((attempt) => attempt.toJSON()),
                confidence: intentConfidence,
            },
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

    const transferStep = transferOf(selection.candidate.attempt)
    if (transferStep !== undefined && !isEphemeraObjectId(groundedObjectIdOf(transferStep.object))) {
        throw new Error('compileAttemptsFromSkeleton: the selected transfer moves a non-Object')
    }

    return {
        type: 'CommandAttempt',
        attempt: selection.candidate.attempt.toJSON(),
        confidence: intentConfidence,
    }
}
