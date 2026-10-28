import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    RoomExit,
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandCommandAttemptResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { AttemptKind, CommandAttempt } from '../../commandAttempt'
import { NarrateAttemptAction } from '../../commandAttempt/action'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import { adjudicateDeferred } from '../../commandAttempt/adjudicate'
import { runIdentityStageOverReferenceKeys } from './identifySkeletonSpans'
import { resolvePureSpanToPool } from './resolvePureSpanToPool'
import type { SpanResolver } from './resolveExactSpan'
import type { CompilePass } from '../../persistentCommand/payload'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { ParseSkeleton } from './parse/parseToken'
import type { TransferMembershipChange } from './plan/planStep'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { navigationIntentErrorMessages } from '../../discriminateIntent/exitResolution'
import { selectPlanTuple } from './selectPlanCandidate'
import type { ConsultAlternative, SpanCandidatePool } from './spanResolution'
import { applyChallengeAnswers, primaryActionIdOf, resumeErrorMessages, type ResumeAnswers } from './resumeAnswers'
import {
    attemptDryRun,
    attemptReferentAnswers,
    attemptReferentNames,
    disambiguationLabels,
    attemptSpanKeys,
    buildAttemptEnvironment,
    defaultPositionsReads,
    expandAndAdjudicateCandidates,
    groundedObjectIdOf,
    proposeAttemptCandidates,
    type GroundedAttemptCandidate,
} from './attemptCandidates'

/**
 * One segmentation of the command and the attempts Plan read from it (`actions/AGENT.contract.md`
 * "Qualifier"): Plan groups every template's readings by the token ranges they cut, on either
 * route (`plan/planSkeleton.ts` `planTokens`). A key names a span occurrence, so one stableRefKey
 * names the same span in every fill that holds it.
 */
export type SkeletonFill<Attempt = CommandAttempt> = {
    skeleton: ParseSkeleton
    attempts: readonly Attempt[]
}

export type CompileAttemptsFromSkeletonInput = {
    command: string
    /** Plan's ungrounded attempts, all of them, by fill (ISS8203 slice 4). The caller routes the zero-attempt case. */
    fills: readonly SkeletonFill[]
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    /** The exits from the actor's room: what an exit span grounds against, and what the dry run judges a navigation by. */
    roomExits?: readonly RoomExit[]
    /** A resumed command's stored answers (`persistentCommand/resume.ts`); absent on a first run. */
    answers?: ResumeAnswers
    /**
     * The pass to start at (`actions/AGENT.contract.md` "Qualifier"). Absent on a first run, which tries
     * the pure pass and falls through to the full one; a resume passes the pass that built its question.
     */
    startPass?: CompilePass
}

export type CompileAttemptsFromSkeletonDeps = {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileAttemptsFromSkeletonResult =
    | ParseCommandCommandAttemptResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

type AttemptEntry = {
    attempt: CommandAttempt
    /** The fill the attempt was read from: the spans it must read, and the words its Consult label is built from. */
    skeleton: ParseSkeleton
}

/** The primary action's `transferMembership`, which Plan's templates always put last (take, drop, containment). */
const transferOf = (attempt: CommandAttempt): TransferMembershipChange | undefined => {
    const actions = attempt.actions()
    const step = actions[actions.length - 1]?.desiredResult
    return step?.kind === 'change' && step.primitive === 'transferMembership' ? step : undefined
}

/** What a look looks at: its narration's referent (a qualified look carries assertions beside it). */
const lookedAtOf = (attempt: CommandAttempt) => attempt.actions().find((action) => action instanceof NarrateAttemptAction)?.referents()[0]

/**
 * Not understood: nothing grounds, or no reading of the command survives. An Abstain hands the command to
 * the next rung (FT-3.2); an Error (understood, but forbidden) is an answer on any rung.
 */
const notUnderstood = (reason: string, intentConfidence: number): ParseCommandAbstainResult => ({ type: 'Abstain', confidence: intentConfidence, reason })

/** An Error refusal is an answer, so it wins over an Abstain refusal that would hand the command on. */
const firstRefusal = (refusals: readonly CompileAttemptsFromSkeletonResult[]): CompileAttemptsFromSkeletonResult => (
    refusals.find((refused) => refused.type === 'Error') ?? refusals[0]!
)

/**
 * An attempt's entry checks, before Identify: the ones that need no spans. Each attempt is judged
 * on its own kind, so one attempt's refusal never decides another's (ISS8203 slice 4.5).
 */
const preIdentityRefusal = (entry: AttemptEntry, input: CompileAttemptsFromSkeletonInput, intentConfidence: number): CompileAttemptsFromSkeletonResult | undefined => {
    const { attempt } = entry
    const { kind } = attempt
    if (kind === 'look') {
        if (lookedAtOf(attempt) === undefined) {
            return notUnderstood(objectManipulationErrorMessages.lookNoTemplateMatch, intentConfidence)
        }
        if (input.characterId === undefined) {
            return { type: 'Error', errorMessage: objectManipulationErrorMessages.noActingCharacter }
        }
        return undefined
    }
    if (kind === 'navigation') {
        // Out of a room there are no exits, so nothing grounds and the reading abstains (it must not
        // answer: the bare exit reading fits every command, and would end every one here).
        return undefined
    }
    if (kind === 'membership' || kind === 'containment' || kind === 'spread') {
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
    const { attempt } = entry
    const { kind } = attempt
    if (kind === 'look') {
        const lookedAt = lookedAtOf(attempt)
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
        case 'containment':
        case 'spread': return 'No combination of two distinct grounded objects produced a well-typed containment move'
        case 'navigation': return navigationIntentErrorMessages.noMatch
    }
}

/**
 * The one producer for Plan's attempts (ISS8203 slices 2-4, and 4.5's per-attempt entry): relational,
 * transfer (take, drop and containment) and look share one Identify, one producer, one environment,
 * one dry run and one selection.
 *
 * Each attempt is classified by its own content and gated by its own entry checks. A refused attempt
 * drops out of the pool with its own refusal; the survivors pool together. A refusal is returned only
 * when nothing survives: the first Error, else the first Abstain, in Plan's order. Once the pool has a
 * survivor, the result is the pool's.
 *
 * The outcome is by reason, not by attempt kind. Not understood (nothing grounds, no reading survives
 * Identify, selection below the floor) is an Abstain, which hands the command to the next rung. A
 * refusal the world gives (the dry run's illegal, such as "The table has no cup.") is an Error with
 * its reason. A defer (a pending challenge) is an Abstain until the deferred adjudication tier judges it.
 * An Error is an answer, so an attempt's own Error refusal wins over a pool that only abstains (a
 * take with no room is refused, though the bare exit reading beside it survives its entry checks).
 */
export async function compileAttemptsFromSkeleton(
    input: CompileAttemptsFromSkeletonInput,
    intentConfidence: number,
    deps: CompileAttemptsFromSkeletonDeps = {}
): Promise<CompileAttemptsFromSkeletonResult> {
    const refusals: CompileAttemptsFromSkeletonResult[] = []
    const result = await compileReadings(input, intentConfidence, deps, refusals)
    return result.type === 'Abstain' ? refusals.find((refused) => refused.type === 'Error') ?? result : result
}

/** The producer's work; `refusals` collects each attempt's own refusal as it is refused. */
async function compileReadings(
    input: CompileAttemptsFromSkeletonInput,
    intentConfidence: number,
    deps: CompileAttemptsFromSkeletonDeps,
    refusals: CompileAttemptsFromSkeletonResult[]
): Promise<CompileAttemptsFromSkeletonResult> {
    if (input.fills.every(({ attempts }) => attempts.length === 0)) {
        throw new Error('compileAttemptsFromSkeleton: no attempts (the caller routes the no-object case)')
    }
    const hostRoomId = input.hostRoomId
    const answers = input.answers
    // An answer chose a reading of the spans it names: a fill that holds none of them was not chosen.
    // An answer no fill holds narrows nothing (it is ignored, as a key no attempt names always was).
    const answeredKeys = Object.keys(answers?.referentAnswers ?? {})
    const holdsAnswer = ({ skeleton }: SkeletonFill): boolean => skeleton.some((token) => token.type === 'objectSpan' && answeredKeys.includes(token.stableRefKey))
    const fills = input.fills.some(holdsAnswer) ? input.fills.filter(holdsAnswer) : input.fills
    const entries = fills.flatMap(({ skeleton, attempts }) => attempts.map((attempt) => ({ attempt, skeleton })))
    // A resumed command's chosen plan narrows the frozen attempts; one no longer among them is stale.
    const chosen = answers?.selectedAttempt === undefined
        ? entries
        : entries.filter(({ attempt }) => primaryActionIdOf(attempt) === answers.selectedAttempt)
    if (chosen.length === 0) {
        return { type: 'Error', errorMessage: resumeErrorMessages.staleSelectedAttempt }
    }

    // Pre-Identify: each attempt's own refusal, then the survivors.
    let survivors: AttemptEntry[] = []
    for (const { attempt, skeleton } of chosen) {
        const entry: AttemptEntry = { attempt, skeleton }
        const refused = preIdentityRefusal(entry, input, intentConfidence)
        if (refused) {
            refusals.push(refused)
        } else {
            survivors.push(entry)
        }
    }
    if (survivors.length === 0) {
        return firstRefusal(refusals)
    }

    // A step (a change, or a qualifier's assertion) needs the room graph, read once for the pool's
    // environment; a relation without one is refused. A plain look has no steps and reads nothing.
    const positionsReads = deps.positionsReadDeps ?? defaultPositionsReads()
    const roomGraph = hostRoomId !== undefined && survivors.some(hasStep)
        ? await positionsReads.getLudicGraph(hostRoomId)
        : undefined
    survivors = survivors.filter((entry) => {
        if (entry.attempt.kind === 'relation' && roomGraph === undefined) {
            refusals.push({ type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom })
            return false
        }
        return true
    })
    if (survivors.length === 0) {
        return firstRefusal(refusals)
    }

    const catalog = mergeObjectManipulationCatalogs(
        input.roomObjectCatalog ?? [],
        input.heldInventoryCatalog ?? []
    )

    const ctx: ProducerContext = { input, intentConfidence, answers, hostRoomId, positionsReads, roomGraph, catalog }
    // Each pass keeps its own refusals, and only the returned pass's join the once-only ones: a discarded
    // pure pass's refusals must not surface as the "first Error over an Abstain".
    if (input.startPass !== 'full') {
        const pureRefusals: CompileAttemptsFromSkeletonResult[] = []
        const pure = await runPurePass(ctx, [...survivors], pureRefusals)
        if (pure !== undefined) {
            refusals.push(...pureRefusals)
            return pure
        }
    }
    const fullRefusals: CompileAttemptsFromSkeletonResult[] = []
    const full = await runFullPass(ctx, [...survivors], fullRefusals, 'full')
    refusals.push(...fullRefusals)
    return full
}

const hasStep = ({ attempt }: AttemptEntry): boolean => attempt.actions().some((action) => action.desiredResult !== undefined)

/** What the once-only steps of `compileReadings` settle, and every pass reads. */
type ProducerContext = {
    input: CompileAttemptsFromSkeletonInput
    intentConfidence: number
    answers: ResumeAnswers | undefined
    hostRoomId: EphemeraRoomId | undefined
    positionsReads: ObjectManipulationPositionsReadDeps
    roomGraph: Awaited<ReturnType<ObjectManipulationPositionsReadDeps['getLudicGraph']>> | undefined
    catalog: ReturnType<typeof mergeObjectManipulationCatalogs>
}

/** One Identify over every surviving fill's spans: a key shared by two fills is one span text, so one pool. */
const identifySurvivors = (ctx: ProducerContext, survivors: readonly AttemptEntry[], resolver?: SpanResolver) => {
    const { input, catalog } = ctx
    const spans = [...new Map(survivors.flatMap(({ skeleton }) => skeleton.flatMap((token) => (
        token.type === 'objectSpan' ? [[token.stableRefKey, token] as const] : []
    )))).values()]
    return runIdentityStageOverReferenceKeys(
        input.command,
        spans,
        attemptSpanKeys(survivors.map((entry) => entry.attempt)),
        { objects: catalog, exits: input.roomExits ?? [] },
        resolver
    )
}

/**
 * The full pass: Identify with the full resolver (every span not matched exactly embeds), then the
 * steps every pass shares. `refusals` is this pass's own list.
 */
async function runFullPass(
    ctx: ProducerContext,
    survivors: AttemptEntry[],
    refusals: CompileAttemptsFromSkeletonResult[],
    pass: CompilePass
): Promise<CompileAttemptsFromSkeletonResult> {
    const { intentConfidence } = ctx
    const identityResult = await identifySurvivors(ctx, survivors)
    if (identityResult.type === 'error') {
        // Nothing in the room or in hand: nothing grounds.
        return identityResult.errorMessage === objectManipulationErrorMessages.noCatalog
            ? notUnderstood(identityResult.errorMessage, intentConfidence)
            : { type: 'Error', errorMessage: identityResult.errorMessage }
    }

    const { spanPools } = identityResult
    survivors = applyExactFillPrecedence(survivors, spanPools)
    survivors = dropPostIdentityRefusals(survivors, intentConfidence, refusals)
    if (survivors.length === 0) {
        return firstRefusal(refusals)
    }
    return proposeToResult(ctx, survivors, spanPools, pass)
}

/**
 * The pure pass: Identify with the pure resolver (no span embeds), keeping only the fills whose every
 * object span matched by name, then the steps every pass shares. Its result stands only if it is a
 * CommandAttempt or a Consult (at least one reading passed the dry run); otherwise it is `undefined`
 * and the full pass runs. `refusals` is this pass's own list, discarded with it.
 */
async function runPurePass(
    ctx: ProducerContext,
    survivors: AttemptEntry[],
    refusals: CompileAttemptsFromSkeletonResult[]
): Promise<CompileAttemptsFromSkeletonResult | undefined> {
    const identityResult = await identifySurvivors(ctx, survivors, resolvePureSpanToPool)
    if (identityResult.type === 'error') {
        return undefined
    }
    const { spanPools, ineligible } = identityResult
    const declined = new Set(ineligible)
    survivors = survivors.filter(({ skeleton }) => !skeleton.some((token) => token.type === 'objectSpan' && declined.has(token.stableRefKey)))
    if (survivors.length === 0) {
        return undefined
    }
    survivors = applyExactFillPrecedence(survivors, spanPools)
    survivors = dropPostIdentityRefusals(survivors, ctx.intentConfidence, refusals)
    if (survivors.length === 0) {
        return undefined
    }
    const result = await proposeToResult(ctx, survivors, spanPools, 'pure')
    return result.type === 'CommandAttempt' || result.type === 'Consult' ? result : undefined
}

/**
 * TEMPORARY BRIDGE (exact-fill precedence, `actions/AGENT.contract.md` "Qualifier"; ladder rung 14
 * reconsiders it):
 * when some fill has every span matched exactly, the fills that don't are dropped. The lexical rank
 * forgives words around a name, so a longer span ("cup from table") would otherwise compete with the
 * exact segmentation, even win when that one is illegal. With no fully exact fill, every fill competes.
 */
function applyExactFillPrecedence(survivors: AttemptEntry[], spanPools: ReadonlyMap<string, SpanCandidatePool>): AttemptEntry[] {
    const isExact = (key: string): boolean => (spanPools.get(key)?.candidates ?? []).some(({ sourceTags }) => sourceTags.includes('exact'))
    const isExactFill = (skeleton: ParseSkeleton): boolean => skeleton.every((token) => token.type !== 'objectSpan' || isExact(token.stableRefKey))
    return survivors.some(({ skeleton }) => isExactFill(skeleton))
        ? survivors.filter(({ skeleton }) => isExactFill(skeleton))
        : survivors
}

/** Post-Identify: each survivor's own refusal (pushed to `refusals`), then the survivors again. */
function dropPostIdentityRefusals(
    survivors: AttemptEntry[],
    intentConfidence: number,
    refusals: CompileAttemptsFromSkeletonResult[]
): AttemptEntry[] {
    return survivors.filter((entry) => {
        const refused = postIdentityRefusal(entry, intentConfidence)
        if (refused) {
            refusals.push(refused)
            return false
        }
        return true
    })
}

/** Propose -> environment -> dry run -> select -> result, over survivors whose spans are grounded. */
async function proposeToResult(
    ctx: ProducerContext,
    survivors: AttemptEntry[],
    spanPools: ReadonlyMap<string, SpanCandidatePool>,
    pass: CompilePass
): Promise<CompileAttemptsFromSkeletonResult> {
    const { input, intentConfidence, answers, hostRoomId, positionsReads, roomGraph, catalog } = ctx
    // The pool's no-assignment reason comes from its first surviving attempt.
    const lead = survivors[0]!
    // A candidate is grounded from its attempt, keeping the Plan-minted action ids: its fill is found by the primary one.
    const skeletonOf = new Map(survivors.map(({ attempt, skeleton }) => [primaryActionIdOf(attempt), skeleton]))
    const proposed = proposeAttemptCandidates({
        command: input.command,
        attempts: survivors.map((entry) => entry.attempt),
        spanPools,
        catalog,
        noAssignmentReason: noAssignmentReasonFor(lead.attempt.kind),
        referentAnswers: answers?.referentAnswers,
        viewAnswers: answers?.viewAnswers,
        actorRoom: hostRoomId,
        actorCharacter: input.characterId,
    })
    if (!proposed.ok) {
        return proposed.stale ? { type: 'Error', errorMessage: proposed.reason } : notUnderstood(proposed.reason, intentConfidence)
    }

    // A pool of plain looks has no steps, so the shared dry run never reads its environment and none is built.
    const env = roomGraph === undefined || hostRoomId === undefined || !survivors.some(hasStep)
        ? undefined
        : await buildAttemptEnvironment(proposed.candidates, hostRoomId, roomGraph, positionsReads, catalog)
    const expanded = env === undefined ? proposed.candidates : expandAndAdjudicateCandidates(proposed.candidates, env)
    const candidates = answers?.challengeAnswers === undefined ? expanded : applyChallengeAnswers(expanded, answers.challengeAnswers)
    const dryRun = (candidate: GroundedAttemptCandidate) => attemptDryRun(candidate, env, {
        roomId: hostRoomId,
        actorCharacterId: input.characterId,
        exits: input.roomExits ?? [],
    })
    const namesOf = new Map<ConsultAlternative, { names: Record<string, string>; placeNames: Record<string, string>; skeleton: ParseSkeleton }>()
    const select = (pool: readonly GroundedAttemptCandidate[]) => selectPlanTuple({
        candidates: pool,
        getConfidence: (candidate) => candidate.confidence,
        dryRun,
        toConsultAlternative: (candidate) => {
            const alternative = {
                ...candidate.alternative,
                referentAnswers: attemptReferentAnswers(candidate.attempt),
                ...(candidate.viewAnswers !== undefined ? { viewAnswers: candidate.viewAnswers } : {}),
            }
            // A part is worded by its position wherever it is asked; the rest keep the object's own name.
            namesOf.set(alternative, {
                names: { ...attemptReferentNames(candidate.attempt), ...candidate.viewLabels },
                placeNames: { ...candidate.placeNames, ...candidate.viewLabels },
                skeleton: skeletonOf.get(primaryActionIdOf(candidate.attempt)) ?? lead.skeleton,
            })
            return alternative
        },
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
        const { alternatives } = selection
        const labelOptions = (pick: 'names' | 'placeNames') => alternatives.map((alternative) => ({
            answers: alternative.referentAnswers ?? {},
            views: alternative.viewAnswers,
            names: namesOf.get(alternative)?.[pick] ?? {},
            skeleton: namesOf.get(alternative)?.skeleton ?? lead.skeleton,
        }))
        // Same-named options (two cups) are told apart by where each sits.
        const byName = disambiguationLabels(labelOptions('names'))
        const labels = new Set(byName).size === byName.length ? byName : disambiguationLabels(labelOptions('placeNames'))
        return {
            type: 'Consult',
            alternatives: selection.alternatives.map(({ proposedCommand, objectId, referentAnswers, viewAnswers }, index) => ({ proposedCommand, objectId, label: labels[index], referentAnswers, ...(viewAnswers !== undefined ? { viewAnswers } : {}) })),
            confidence: intentConfidence,
            pass,
            // All of Plan's fills and attempts, not the survivors: a resume restarts from the same frozen set.
            root: {
                command: input.command,
                fills: input.fills.map(({ skeleton, attempts }) => ({ skeleton, attempts: attempts.map((attempt) => attempt.toJSON()) })),
                confidence: intentConfidence,
            },
        }
    }

    if (selection.verdict === 'abstain') {
        return notUnderstood(selection.reason, intentConfidence)
    }

    if (selection.verdict === 'error') {
        return { type: 'Error', errorMessage: selection.reason }
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
