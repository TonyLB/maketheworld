import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import type { RoomExit } from '../../baseClasses'
import { navigationIntentErrorMessages, normalizeCommandToken } from '../../discriminateIntent/exitResolution'
import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'
import { objectSpansIn } from '../../commandAttempt/referent'
import { NarrateAttemptAction, NavigateAttemptAction, PositionAttemptAction, type AttemptAction } from '../../commandAttempt/action'
import { CommandAttempt } from '../../commandAttempt'
import { adjudicateAttempt } from '../../commandAttempt/adjudicate'
import { attemptActionsFromTransfer } from '../../commandAttempt/expandBoundaryChallenges'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { enumerateIdentityAssignments } from './enumerateIdentityAssignments'
import type { IdentityPlanIdentity } from './identityPlanCandidate'
import { defaultReading, placementHostsOfView, readingLabel, readingsHere, readingsOf, wholeReadingLabel, type ViewAnswer } from '../../objectViews'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import { viewMintedByExtend } from './plan/planStep'
import type { ContainedByAssertion, ExtendChange, GroundedId, GroundedReferent, PlanStep, Referent, TransferMembershipChange } from './plan/planStep'
import { buildReferentAssignment } from './synthesize/buildReferentAssignment'
import { groundPlanStep } from './synthesize/groundChange'
import { runExecutor, seedFromGroundedSteps } from './synthesize/executor'
import type { ExecutorRelationalChain, ExpansionEnvironment } from './synthesize/executorTypes'
import { walkAncestryContainers } from './synthesize/findShardBoundary'
import { fetchRelationalReachability } from '../../../positions/manipulation/relational/findRelationalChainsForRemoval'
import type { SpanName } from './stampCandidateReferents'
import type { ConsultAlternative, ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'
import { objectManipulationErrorMessages, qualifierErrorMessages } from './resolveObjectSpan'
import type { DryRunOutcome } from './validatePlanDryRun'
import { resumeErrorMessages } from './resumeAnswers'
import type { ParseSkeleton } from './parse/parseToken'

/**
 * The shared producer for Plan's attempts (ISS8203 slices 2-4): relational, transfer (take, drop
 * and containment) and describe. Every attempt goes through one Identify, one Enumerate, one Ground
 * and describe pass, then one Expansion and Adjudicate, one dry run and one selection.
 * `compileAttemptsFromSkeleton.ts` is its one entry.
 */

export type AttemptPositionsReads = Pick<ObjectManipulationPositionsReadDeps, 'getLudicGraph' | 'getMembershipContainers'>

export const defaultPositionsReads = (): AttemptPositionsReads => ({
    getMembershipContainers: (objectId) => internalCache.Positions.getMembershipContainers(objectId),
    getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
})

/**
 * One producer candidate: a joint identity assignment written onto every action (grounded),
 * described (its description and Consult wording built from the grounded names), and wrapped
 * in an attempt. `alternative` is the primary action's Consult wording.
 */
export type GroundedAttemptCandidate = {
    attempt: CommandAttempt
    confidence: number
    alternative: ConsultAlternative
    /** The part of each object this candidate means, by stableRefKey, for an object seen in several positions (what answering stores). The attempt carries a `view` only for a part, never for the whole. */
    viewAnswers?: Record<string, ViewAnswer>
    /** The option wording of each such part ("the cloth on the table", "both parts of the cloth"). */
    viewLabels?: Record<string, string>
    /** Each referent's name qualified by where it sits, for telling same-named options apart. */
    placeNames?: Record<string, string>
}

export type ProposeAttemptCandidatesResult =
    | { ok: true; candidates: GroundedAttemptCandidate[] }
    /** `stale`: a resumed command's answer no longer fits the world, so it is an Error whatever the route. */
    | { ok: false; reason: string; stale?: true }

export type ProposeAttemptCandidatesInput = {
    command: string
    attempts: readonly CommandAttempt[]
    spanPools: ReadonlyMap<string, SpanCandidatePool>
    catalog: readonly ObjectManipulationCatalogEntry[]
    /** Abstain wording when no joint assignment survives Enumerate (route-specific, as today). */
    noAssignmentReason: string
    /** A resumed command's `stableRefKey` to thing id: narrows that span's pool to the chosen object. */
    referentAnswers?: Readonly<Record<string, string>>
    /** A resumed command's `stableRefKey` to the part chosen: narrows that object's positions to the one meant. */
    viewAnswers?: Readonly<Record<string, ViewAnswer>>
    /** The actor's room: it decides which position of an object is the actor's own (PR-2). Absent, an object is never asked about by position. */
    actorRoom?: EphemeraRoomId
    /** The actor: a part it holds is at its position too (the room's cache holds no character to walk through). */
    actorCharacter?: EphemeraCharacterId
}

/** Where the actor stands: its room, and itself (what it holds is where it is). */
type ActorPosition = { room: EphemeraRoomId; character?: EphemeraCharacterId }

/** One way an object can be meant: the bindings to stamp as the referent's `view` (the whole is every own binding); `answer` is absent where nothing was asked. */
type ViewChoice = { answer?: ViewAnswer; view?: EphemeraPresenceNodeId[]; label?: string }

const sameBindings = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((binding) => b.includes(binding))

const answerMatches = (choice: ViewChoice, answered: ViewAnswer): boolean => (
    answered === 'whole'
        ? choice.answer === 'whole'
        : Array.isArray(choice.answer) && sameBindings(choice.answer, answered)
)

/**
 * The ways an object is meant. An object with a unique position at the actor's (PR-2) is meant there,
 * stamped as the view unasked, whether or not it has other positions. Otherwise each position at the
 * actor's is a choice, plus all of them together (PR-4; not for a destination, which a mover lands under
 * one part of), and the dry run keeps only the choices the verb can act on. A position out of the actor's
 * reach (another room) is never offered. An object with no position to name has no view.
 */
const viewChoicesFor = (
    entry: ObjectManipulationCatalogEntry | undefined,
    actor: ActorPosition | undefined,
    catalog: readonly ObjectManipulationCatalogEntry[],
    isDestination: boolean
): ViewChoice[] => {
    if (entry?.placement === undefined || actor === undefined) {
        return [{}]
    }
    const here = readingsHere(entry.objectId, entry.placement, actor.room, actor.character)
    if (here.length === 1) {
        // Not an answer: nothing was asked, so the row, resume and labels never see it.
        return [{ view: here[0]!.bindings }]
    }
    if (here.length === 0) {
        return [{}]
    }
    const naming = hostNaming(catalog, actor)
    const parts = here.map((reading): ViewChoice => ({ answer: reading.bindings, view: reading.bindings, label: readingLabel(entry.normalizedShortName, reading, naming) }))
    // A mover lands under one part of a destination, never under all of them at once: no whole there.
    return isDestination
        ? parts
        : [...parts, { answer: 'whole', view: here.flatMap(({ bindings }) => bindings), label: wholeReadingLabel(entry.normalizedShortName) }]
}

const hostNaming = (catalog: readonly ObjectManipulationCatalogEntry[], actor: ActorPosition) => ({
    actorRoom: actor.room,
    actorCharacter: actor.character,
    nameOf: (host: EphemeraMembershipHostId): string | undefined => catalog.find(({ objectId }) => objectId === host)?.normalizedShortName,
})

/** An object's name qualified by the position it is meant in, or its bare name where it has no position to give. */
const placeNameOf = (
    entry: ObjectManipulationCatalogEntry | undefined,
    choice: ViewChoice,
    actor: ActorPosition | undefined,
    catalog: readonly ObjectManipulationCatalogEntry[],
    fallback: string
): string => {
    if (choice.label !== undefined) {
        return choice.label
    }
    if (entry?.placement === undefined || actor === undefined) {
        return fallback
    }
    const readings = readingsOf(entry.objectId, entry.placement)
    const reading = defaultReading(entry.objectId, entry.placement, actor.room, actor.character) ?? (readings.length === 1 ? readings[0] : undefined)
    return reading === undefined ? fallback : readingLabel(entry.normalizedShortName, reading, hostNaming(catalog, actor))
}

/** Every object-span referent the attempts name, in first-appearance order, one per stableRefKey. */
const distinctSpanReferents = (attempts: readonly CommandAttempt[]): Extract<Referent, { referentType: 'objectSpan' }>[] => {
    const seen = new Map<string, Extract<Referent, { referentType: 'objectSpan' }>>()
    for (const action of attempts.flatMap((attempt) => attempt.actions())) {
        for (const referent of action.referents().flatMap(objectSpansIn)) {
            if (referent.stableRefKey !== undefined && !seen.has(referent.stableRefKey)) {
                seen.set(referent.stableRefKey, referent)
            }
        }
    }
    return [...seen.values()]
}

/** The stableRefKeys a transfer in the attempts moves something onto: the objects a mover lands under one part of. */
const destinationSpanKeys = (attempts: readonly CommandAttempt[]): Set<string> => new Set(
    attempts.flatMap((attempt) => attempt.actions()).flatMap((action) => {
        const step = action.desiredResult
        return step?.kind === 'change' && step.primitive === 'transferMembership'
            ? objectSpansIn(step.to).flatMap(({ stableRefKey }) => (stableRefKey === undefined ? [] : [stableRefKey]))
            : []
    })
)

/** The distinct stableRefKeys the attempts name, in first-appearance order: Identify's key set. */
export const attemptSpanKeys = (attempts: readonly CommandAttempt[]): string[] =>
    distinctSpanReferents(attempts).map((span) => span.stableRefKey!)

/** The stableRefKeys one action names, distinct: the set that must resolve to distinct ids. */
const actionSpanKeys = (action: AttemptAction): string[] => [
    ...new Set(action.referents().flatMap(objectSpansIn).map((span) => span.stableRefKey).filter((key): key is string => key !== undefined)),
]

/**
 * The joint identity assignment an attempt was grounded with: stableRefKey to object id, read off its
 * grounded object-span referents (across all its actions, so a multi-action attempt gives the whole
 * assignment). What answering a Consult alternative stores; the attempt stays the one source of truth.
 */
export const attemptReferentAnswers = (attempt: CommandAttempt): Record<string, EphemeraObjectId> => Object.fromEntries(
    attempt.actions().flatMap((action) => action.referents().flatMap(objectSpansIn)).flatMap((span) => (
        span.stableRefKey !== undefined && span.groundedId !== undefined && isEphemeraObjectId(span.groundedId)
            ? [[span.stableRefKey, span.groundedId] as const]
            : []
    ))
)

/** The grounded short name of each object span an attempt names, by stableRefKey. */
export const attemptReferentNames = (attempt: CommandAttempt): Record<string, string> => Object.fromEntries(
    attempt.actions().flatMap((action) => action.referents().flatMap(objectSpansIn)).flatMap((span) => (
        span.stableRefKey !== undefined && span.shortName !== undefined ? [[span.stableRefKey, span.shortName] as const] : []
    ))
)

/**
 * Select option labels for one question, from each alternative's joint answers and names. Where a
 * single referent is ambiguous the options are just its names ("Red cup" / "Blue cup"), even if the
 * command names other, settled referents. Where several are ambiguous, a name alone can't say which
 * slot it fills, so each option is the whole command as the player typed it, with each object span
 * replaced by the name that option assigns it ("put Red cup on Blue cup"). A span with no grounded
 * name keeps its text.
 */
export const disambiguationLabels = (
    options: readonly { answers: Record<string, string>; names: Record<string, string>; views?: Record<string, ViewAnswer>; skeleton: ParseSkeleton }[]
): string[] => {
    const keys = [...new Set(options.flatMap(({ answers }) => Object.keys(answers)))]
    // Two options differ on a key by the object, or by the part of it that is meant.
    const ambiguous = keys.filter((key) => new Set(options.map(({ answers, views }) => JSON.stringify([answers[key], views?.[key]]))).size > 1)
    if (ambiguous.length === 1) {
        const [key] = ambiguous
        return options.map(({ names }) => names[key] ?? key)
    }
    // The whole command, from the fill the option reads: options from different fills name different spans.
    return options.map(({ names, skeleton }) => skeleton
        .map((token) => (token.type === 'objectSpan' ? names[token.stableRefKey] ?? token.span : token.text))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
}

/** A referent's name for prose: the grounded short name, else the span text. */
const labelOf = (referent: Referent): string => {
    const [span] = objectSpansIn(referent)
    return span?.shortName ?? span?.span ?? referent.referentType
}

export const groundedObjectIdOf = (referent: Referent): EphemeraObjectId => {
    const [span] = objectSpansIn(referent)
    const id = span?.groundedId
    if (id === undefined || !isEphemeraObjectId(id)) {
        throw new Error('attemptCandidates: expected a grounded Object id on a described referent')
    }
    return id
}

/** The plan steps behind an attempt's position actions. */
const planStepsOf = (actions: readonly AttemptAction[]): PlanStep[] => actions.flatMap((action) => (
    action instanceof PositionAttemptAction && action.desiredResult !== undefined ? [action.desiredResult as PlanStep] : []
))

/**
 * Describes one grounded action: its prose description and its Consult wording (the per-kind describer,
 * one per desired-result kind). Keeps today's strings exactly, so the published attempt is unchanged.
 * A transfer with no containment is a membership move (take or drop), described as before.
 */
const describeGroundedAction = (action: AttemptAction, attemptSteps: readonly PlanStep[]): { action: AttemptAction; alternative: ConsultAlternative } => {
    if (action instanceof NarrateAttemptAction) {
        const [referent] = action.referents()
        if (referent === undefined) {
            throw new Error('attemptCandidates: a narration action names no referent')
        }
        const label = labelOf(referent)
        const description = `Look at the ${label}`
        return {
            action: new NarrateAttemptAction(action.id, action.challenges(), description, action.referents()),
            alternative: { objectId: groundedObjectIdOf(referent), label, proposedCommand: `look at the ${label}` },
        }
    }
    if (action instanceof NavigateAttemptAction) {
        // An exit is never a Consult answer (same-named exits are the dry run's to refuse), so the wording carries no object.
        const exit = labelOf(action.destination)
        return {
            action: new NavigateAttemptAction(action.id, action.challenges(), action.destination),
            alternative: { label: exit, proposedCommand: `go ${exit}` },
        }
    }
    if (!(action instanceof PositionAttemptAction) || action.desiredResult === undefined) {
        throw new Error('attemptCandidates: a position action has no desired result')
    }
    const step = action.desiredResult
    if (step.kind === 'assertion') {
        // A qualifier's check: described for the record, never the primary (the action it qualifies comes last).
        const subject = labelOf(step.subject)
        const host = labelOf(step.object)
        const preposition = step.relation === 'On' ? 'on' : step.relation === 'In' ? 'in' : 'at'
        return {
            action: new PositionAttemptAction(action.id, action.challenges(), step, `Check: ${subject} ${preposition} ${host}`),
            alternative: { objectId: groundedObjectIdOf(step.subject), label: subject, proposedCommand: `look at the ${subject}` },
        }
    }
    if (step.primitive === 'transferMembership') {
        const subject = labelOf(step.object)
        if (step.containment === undefined) {
            const verb = step.to.referentType === 'actingCharacter' ? 'take' : 'drop'
            return {
                action: new PositionAttemptAction(action.id, action.challenges(), step, `${verb === 'take' ? 'Take' : 'Drop'}: ${subject}`),
                alternative: { objectId: groundedObjectIdOf(step.object), label: subject, proposedCommand: `${verb} the ${subject}` },
            }
        }
        const target = labelOf(step.to)
        const preposition = step.containment === 'On' ? 'on' : 'in'
        // A move of the binding an extend minted is the spread's second step: it reads as the spread.
        if (viewMintedByExtend(step.object, attemptSteps)) {
            return {
                action: new PositionAttemptAction(action.id, action.challenges(), step, `Spread ${subject} ${preposition} ${target}`),
                alternative: { label: `${subject} / ${target}`, proposedCommand: `spread the ${subject} ${preposition} the ${target}` },
            }
        }
        return {
            action: new PositionAttemptAction(action.id, action.challenges(), step, `Put ${subject} ${preposition} ${target}`),
            alternative: { label: `${subject} / ${target}`, proposedCommand: `put the ${subject} ${preposition} the ${target}` },
        }
    }
    if (step.primitive === 'extend') {
        const subject = labelOf(step.object)
        return {
            action: new PositionAttemptAction(action.id, action.challenges(), step, `Extend ${subject}`),
            alternative: { objectId: groundedObjectIdOf(step.object), label: subject, proposedCommand: `extend the ${subject}` },
        }
    }
    if (step.primitive === 'establishRelation' || step.primitive === 'dissolveRelation') {
        const subject = labelOf(step.subject)
        const target = labelOf(step.target)
        const label = `${subject} / ${target}`
        if (step.primitive === 'dissolveRelation') {
            return {
                action: new PositionAttemptAction(action.id, action.challenges(), step, `Dissolve relation: ${label}`),
                alternative: { label, proposedCommand: `separate the ${subject} from the ${target}` },
            }
        }
        const preposition = step.relationKind === 'Custom' ? step.relationLabel : step.relationKind.toLowerCase()
        return {
            action: new PositionAttemptAction(action.id, action.challenges(), step, `Establish relation: ${label}`),
            alternative: { label, proposedCommand: `put the ${subject} ${preposition} the ${target}` },
        }
    }
    throw new Error('attemptCandidates: no describer for this change')
}

/**
 * Enumerate, then Ground and describe, for the shared producer. Pools come from Identify (one per
 * stableRefKey). Abstains with the keyed-pool wording when a referent has no usable pool, and with
 * `noAssignmentReason` when no joint assignment is well-typed.
 */
export const proposeAttemptCandidates = (input: ProposeAttemptCandidatesInput): ProposeAttemptCandidatesResult => {
    const allPools = new Map<string, readonly ObjectSpanCandidate[]>()
    for (const span of distinctSpanReferents(input.attempts)) {
        const key = span.stableRefKey!
        const pool = input.spanPools.get(key)
        if (!pool) {
            return { ok: false, reason: `No resolution supplied for stableRefKey "${key}"` }
        }
        // identityFromSpanCandidate (via enumerateIdentityAssignments) throws on anything but an
        // Object, or the Room an exit span's pool names.
        allPools.set(key, (pool.shortlist ?? pool.candidates).filter((candidate) => isEphemeraObjectId(candidate.id) || isEphemeraRoomId(candidate.id)))
    }
    // A span nothing grounds drops the attempts that read it, and only those: one attempt's
    // refusal never decides another's (a bare exit reading of `take cup` grounds to no exit, and
    // the take still stands). With no attempt left, the first such span is the reason.
    const emptyKeys = [...allPools].filter(([, candidates]) => candidates.length === 0).map(([key]) => key)
    // A resumed answer names a span the player chose for: if nothing grounds there now, the answer is stale.
    const staleKey = emptyKeys.find((key) => input.referentAnswers?.[key] !== undefined)
    if (staleKey !== undefined) {
        return { ok: false, reason: resumeErrorMessages.staleReferentAnswer(input.spanPools.get(staleKey)!.span), stale: true }
    }
    const attempts = input.attempts.filter((attempt) => !attemptSpanKeys([attempt]).some((key) => emptyKeys.includes(key)))
    if (attempts.length === 0) {
        return { ok: false, reason: `No candidates found for span "${input.spanPools.get(emptyKeys[0]!)?.span}"` }
    }
    const pools = new Map<string, readonly ObjectSpanCandidate[]>()
    for (const key of attemptSpanKeys(attempts)) {
        const candidates = allPools.get(key)!
        const answered = input.referentAnswers?.[key]
        if (answered !== undefined) {
            // A chosen object no longer in the fresh pool is a stale answer: refuse rather than act on its id.
            const chosen = candidates.filter((candidate) => candidate.id === answered)
            if (chosen.length === 0) {
                return { ok: false, reason: resumeErrorMessages.staleReferentAnswer(input.spanPools.get(key)!.span), stale: true }
            }
            pools.set(key, chosen)
            continue
        }
        pools.set(key, candidates)
    }
    for (const action of attempts.flatMap((attempt) => attempt.actions())) {
        for (const referent of action.referents().flatMap(objectSpansIn)) {
            if (referent.stableRefKey === undefined) {
                return { ok: false, reason: `objectSpan referent for span "${referent.span}" has no stableRefKey to ground against` }
            }
        }
    }

    // A step's distinct span keys must bind distinct objects: "put cup on cup" is never a candidate,
    // and that rule is the same for every route (it is the case stableRefKey exists for). Assignments
    // are joint across attempts, so a key two attempts share binds one object in both. The rule drops
    // an attempt under an assignment, not the assignment: one reading that needs two tables ("table on
    // table") must not sink another reading of the same command that needs one.
    const bindsDistinct = (attempt: CommandAttempt, identities: ReadonlyMap<string, IdentityPlanIdentity>): boolean => (
        attempt.actions().every((action) => {
            const ids = actionSpanKeys(action).map((key) => identities.get(key)?.id)
            return new Set(ids).size === ids.length
        })
    )
    const assignments = enumerateIdentityAssignments(pools).filter(({ identities }) => (
        attempts.some((attempt) => bindsDistinct(attempt, identities))
    ))
    if (assignments.length === 0) {
        return { ok: false, reason: input.noAssignmentReason }
    }

    // An object seen in several positions is one candidate per way it can be meant (the actor's own position
    // picks one, else each position and the whole), and a resumed command's answer keeps only the one chosen.
    const destinationKeys = destinationSpanKeys(attempts)
    const actor: ActorPosition | undefined = input.actorRoom === undefined ? undefined : { room: input.actorRoom, character: input.actorCharacter }
    const viewed = assignments.flatMap(({ identities, confidence }) => {
        const perKey = [...identities].map(([key, identity]) => {
            const entry = input.catalog.find((catalogEntry) => catalogEntry.objectId === identity.id)
            const answered = input.viewAnswers?.[key]
            const choices = viewChoicesFor(entry, actor, input.catalog, destinationKeys.has(key))
            return { key, identity, entry, choices: answered === undefined ? choices : choices.filter((choice) => choice.answer !== undefined && answerMatches(choice, answered)) }
        })
        return perKey.reduce<{ key: string; choice: ViewChoice }[][]>(
            (partials, { key, choices }) => partials.flatMap((partial) => choices.map((choice) => [...partial, { key, choice }])),
            [[]]
        ).map((chosen) => ({ identities, confidence, chosen: new Map(chosen.map(({ key, choice }) => [key, choice])) }))
    })
    if (viewed.length === 0 && input.viewAnswers !== undefined && Object.keys(input.viewAnswers).length > 0) {
        const [staleKey] = Object.keys(input.viewAnswers)
        return { ok: false, reason: resumeErrorMessages.staleReferentAnswer(input.spanPools.get(staleKey!)?.span ?? staleKey!), stale: true }
    }

    // One candidate per attempt per grounding of its own keys, which it binds distinctly: each is built
    // from its own attempt's actions only, and its confidence is the min over its own keys. The joint
    // assignment spans every attempt's keys (one Enumerate for the pool), so a key another attempt
    // reads neither lowers this one's confidence nor repeats it.
    const ownKeysOf = new Map(attempts.map((attempt) => [attempt, attemptSpanKeys([attempt])]))
    const seen = new Set<string>()
    const candidates = viewed.flatMap(({ identities, chosen }) => {
        const names = new Map<string, SpanName>()
        const viewAnswers: Record<string, ViewAnswer> = {}
        const viewLabels: Record<string, string> = {}
        const placeNames: Record<string, string> = {}
        for (const [key, identity] of identities) {
            const entry = input.catalog.find((catalogEntry) => catalogEntry.objectId === identity.id)
            const choice = chosen.get(key) ?? {}
            // A room (an exit's destination) has no catalog entry: it is named by the exit.
            const shortName = entry?.normalizedShortName ?? identity.label
            names.set(key, {
                id: identity.id,
                shortName,
                gloss: entry?.gloss,
                presence: entry?.presence,
                ...(choice.view !== undefined ? { view: choice.view } : {}),
            })
            placeNames[key] = placeNameOf(entry, choice, actor, input.catalog, shortName)
            if (choice.answer !== undefined) {
                viewAnswers[key] = choice.answer
                viewLabels[key] = choice.label!
            }
        }
        const asked = Object.keys(viewAnswers).length > 0
        return attempts.filter((attempt) => bindsDistinct(attempt, identities)).flatMap((attempt): GroundedAttemptCandidate[] => {
            const ownKeys = ownKeysOf.get(attempt)!
            const grounding = `${attempts.indexOf(attempt)}|${ownKeys.map((key) => `${identities.get(key)?.id}:${JSON.stringify(chosen.get(key)?.answer ?? null)}`).join('|')}`
            if (seen.has(grounding)) {
                return []
            }
            seen.add(grounding)
            const confidence = ownKeys.reduce((least, key) => Math.min(least, identities.get(key)?.jointRelevance ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY)
            const described = attempt.actions().map((action) => describeGroundedAction(action.grounded(names), planStepsOf(attempt.actions())))
            const primary = described[described.length - 1]!
            return [{
                attempt: CommandAttempt.create(attempt.kind, input.command, described.map((entry) => entry.action), attempt.narrationUnits()),
                confidence,
                alternative: primary.alternative,
                placeNames,
                ...(asked ? { viewAnswers, viewLabels } : {}),
            }]
        })
    })
    return { ok: true, candidates }
}

/** Every distinct grounded object id the candidates name: what the ancestry prefetch walks. */
const candidateObjectIds = (candidates: readonly GroundedAttemptCandidate[]): EphemeraObjectId[] => {
    const ids = new Set<EphemeraObjectId>()
    for (const candidate of candidates) {
        for (const action of candidate.attempt.actions()) {
            for (const span of action.referents().flatMap(objectSpansIn)) {
                if (span.groundedId !== undefined && isEphemeraObjectId(span.groundedId)) {
                    ids.add(span.groundedId)
                }
            }
        }
    }
    return [...ids]
}

/**
 * The per-command environment: the room graph, plus each candidate object's host graph
 * found by an eager, depth-capped ancestry walk. Built once for the whole pool. A
 * `findShardBoundary` walk reaches past intermediate hosts, so one-hop lookups would dead-end.
 * Also every shard a relation touching a candidate can cross into (`fetchRelationalReachability`,
 * the same walk chain-aware removal uses): Expansion and the dry run follow a crossing to its far
 * end, which may sit in a shard no ancestry walk reaches.
 */
export const buildAttemptEnvironment = async (
    candidates: readonly GroundedAttemptCandidate[],
    hostRoomId: EphemeraRoomId,
    roomGraph: EphemeraLudicGraph | undefined,
    reads: AttemptPositionsReads,
    catalog: readonly ObjectManipulationCatalogEntry[] = []
): Promise<ExpansionEnvironment> => {
    const objectIds = candidateObjectIds(candidates)
    const getMembershipContainersForWalk = (id: EphemeraPositionAdjacencyContainedId): Promise<EphemeraMembershipHostId[]> =>
        // Candidates, and everything their walk can reach, are Objects until a Room/Area ends the branch.
        reads.getMembershipContainers(id as EphemeraObjectId)

    const containersByHostId = new Map<EphemeraMembershipHostId, EphemeraMembershipHostId[]>()
    const ancestryMaps = await Promise.all(objectIds.map((objectId) => walkAncestryContainers(objectId, getMembershipContainersForWalk)))
    ancestryMaps.forEach((ancestryMap) => ancestryMap.forEach((containers, hostId) => {
        containersByHostId.set(hostId, containers)
    }))

    const hostByObjectId = new Map<EphemeraObjectId, EphemeraMembershipHostId>()
    for (const objectId of objectIds) {
        const containers = containersByHostId.get(objectId)
        if (containers?.length === 1) {
            hostByObjectId.set(objectId, containers[0])
        }
    }

    // An absent graph is left absent: Expansion reports what it cannot see, as it does for any host.
    // Every host of a candidate, not only a lone one: a take of a thing in several hosts leaves them all (the take rule).
    const hostGraphMap = new Map<EphemeraMembershipHostId, EphemeraLudicGraph | undefined>([[hostRoomId, roomGraph]])
    for (const hostId of objectIds.flatMap((objectId) => containersByHostId.get(objectId) ?? [])) {
        if (!hostGraphMap.has(hostId)) {
            hostGraphMap.set(hostId, await reads.getLudicGraph(hostId))
        }
    }
    const reachable = await fetchRelationalReachability(
        new Set(objectIds),
        (id) => reads.getMembershipContainers(id as EphemeraObjectId),
        async (hostId) => hostGraphMap.get(hostId) ?? reads.getLudicGraph(hostId)
    )
    for (const [hostId, graph] of reachable) {
        if (hostGraphMap.get(hostId) === undefined) {
            hostGraphMap.set(hostId, graph)
        }
    }

    return {
        getGraph: (hostId) => hostGraphMap.get(hostId),
        getCurrentHost: (objectId) => hostByObjectId.get(objectId),
        getMembershipContainers: (id) => containersByHostId.get(id) ?? [],
        getViewHosts: (id, view) => {
            const placement = catalog.find(({ objectId }) => objectId === id)?.placement
            return placement === undefined ? undefined : placementHostsOfView(id, placement, view)
        },
    }
}

/**
 * The acting character and room the dry run's derived referents resolve against (`actingCharacter`,
 * `currentHost(actingCharacter)`), and the room's exits, which a navigation is judged by.
 */
export type DryRunFrame = {
    roomId?: EphemeraRoomId
    actorCharacterId?: EphemeraCharacterId
    exits?: readonly RoomExit[]
}

/**
 * "X is an exit here": the exit the navigate action names leads, from this room, to the room it
 * grounded to, and to no other. A name leading to two rooms is refused rather than asked about
 * (asking which is shelved): every reading of it is illegal, so the answer is the ambiguity.
 */
const navigationFailure = (action: NavigateAttemptAction, exits: readonly RoomExit[]): string | undefined => {
    const [destination] = objectSpansIn(action.destination)
    const name = normalizeCommandToken(destination?.shortName ?? destination?.span ?? '')
    const targets = new Set(exits.filter(({ normalizedName }) => normalizedName === name).map(({ targetId }) => targetId))
    if (destination?.groundedId === undefined || !targets.has(destination.groundedId as EphemeraRoomId)) {
        return navigationIntentErrorMessages.noMatch
    }
    return targets.size > 1 ? navigationIntentErrorMessages.ambiguousMatch : undefined
}

/**
 * The shared dry run: grounds each position step in full (derived referents such as
 * containment's `currentHost(subject)` resolve against the environment), seeds the executor with
 * every grounded step and runs it. Narration has no steps, so it is `legal` with nothing to run
 * (a look has no preconditions and no mutation).
 *
 * ISS8203 slice 3: a transfer's preconditions are checked here, whichever template produced it.
 * The moved object is in one host, or its view says which part moves (an object in several hosts with no view
 * never grounds a `from`, so it is refused as having no membership host); `from` is a host the moving part is actually in (`notCarryingObject` for a drop of something not
 * held, since a drop's `from` is the actor); and the part is not already in `to` (`alreadyHoldingObject`). A pending challenge defers, and a
 * refused one is illegal, so a doubt about the move is a challenge and never a separate defer.
 *
 * An assertion (a qualifier's `containedBy`) is judged in step order and never seeded: one that fails
 * makes the candidate illegal with its reason, so the selection loop drops the candidates it rules out.
 * A navigation has no step: it is judged against the frame's exits (`navigationFailure`).
 */
export const attemptDryRun = (candidate: GroundedAttemptCandidate, env: ExpansionEnvironment | undefined, frame: DryRunFrame = {}): DryRunOutcome => {
    for (const action of candidate.attempt.actions()) {
        const failure = action instanceof NavigateAttemptAction ? navigationFailure(action, frame.exits ?? []) : undefined
        if (failure !== undefined) {
            return { verdict: 'illegal', decidable: true, reason: failure }
        }
    }
    const steps = candidate.attempt.actions().flatMap((action) => action.desiredResult ? [action.desiredResult] : [])
    if (steps.length === 0) {
        return { verdict: 'legal', decidable: true }
    }
    if (env === undefined) {
        throw new Error('attemptDryRun: a position step needs the per-command environment')
    }
    const { result } = candidate.attempt
    if (result.status === 'impossible') {
        return { verdict: 'illegal', decidable: true, reason: result.reason }
    }
    if (result.status === 'pending') {
        // The pending challenge's own wording: a peer move and an exit contact need different adjudication.
        const pending = candidate.attempt.actions().flatMap((action) => action.challenges()).find((challenge) => challenge.verdict === undefined)
        return { verdict: 'defer', decidable: true, reason: pending?.describe() ?? 'A challenge on this move is pending adjudication' }
    }

    const seeds: PlanStep<GroundedReferent>[] = []
    for (const step of steps) {
        const spans = new Map<string, GroundedId>()
        for (const span of stepSpans(step)) {
            if (span.stableRefKey !== undefined && span.groundedId !== undefined) {
                spans.set(span.stableRefKey, span.groundedId)
            }
        }
        const assignment = buildReferentAssignment(step, spans, {
            actingCharacter: frame.actorCharacterId,
            currentHost: (id) => (id === frame.actorCharacterId ? frame.roomId : isEphemeraObjectId(id) ? env.getCurrentHost(id) : undefined),
            viewHosts: (id, view) => (isEphemeraObjectId(id) ? env.getViewHosts?.(id, view) : undefined),
        })
        if (assignment === undefined) {
            return { verdict: 'illegal', decidable: true, reason: objectManipulationErrorMessages.noMembershipHost }
        }
        const grounded = groundPlanStep(step, assignment)
        if (grounded.kind === 'assertion') {
            // A qualifier is judged here, before the steps after it, and has nothing for the executor to lower.
            const failure = containedByFailure(grounded, env)
            if (failure !== undefined) {
                return { verdict: 'illegal', decidable: true, reason: failure }
            }
            continue
        }
        if (grounded.kind === 'change' && grounded.primitive === 'extend') {
            // Extend writes no host-level effect for the executor to lower: only its precondition is judged here.
            const precondition = extendPreconditionFailure(grounded)
            if (precondition !== undefined) {
                return { verdict: 'illegal', decidable: true, reason: precondition }
            }
            continue
        }
        if (grounded.kind === 'change' && grounded.primitive === 'transferMembership') {
            const precondition = transferPreconditionFailure(grounded, env)
            if (precondition !== undefined) {
                return { verdict: 'illegal', decidable: true, reason: precondition }
            }
        }
        seeds.push(grounded)
    }

    if (seeds.length === 0) {
        return { verdict: 'legal', decidable: true }
    }
    const outcome = runExecutor(seedFromGroundedSteps(seeds), env)
    if (outcome.verdict === 'error') {
        return { verdict: 'illegal', decidable: true, reason: outcome.reason }
    }
    if (outcome.verdict === 'defer') {
        return { verdict: 'defer', decidable: outcome.decidable, reason: outcome.reason }
    }

    const primary = seeds[seeds.length - 1]!
    if (primary.kind === 'change' && primary.primitive === 'transferMembership') {
        const transferStep = outcome.steps.find((step) => step.kind === 'transferMembership')
        if (!transferStep) {
            return { verdict: 'illegal', decidable: true, reason: objectManipulationErrorMessages.unimplementedAtomicOperation }
        }
        return { verdict: 'legal', decidable: true, plan: { steps: outcome.steps } }
    }

    // The one edge seeded retires as its one chain.
    const chain = outcome.steps.find((step): step is ExecutorRelationalChain => step.kind === 'relationalChain')
    if (chain === undefined) {
        return { verdict: 'illegal', decidable: true, reason: 'No relational chain found for this candidate' }
    }
    // Hosting kinds are rejected by the narrow relation vocabulary before a candidate exists, so
    // this check guards the chain's first edge only (see the relational route's notes).
    const firstEdge = chain.steps.find((step) => step.type === 'edge')
    if (firstEdge === undefined || firstEdge.type !== 'edge') {
        return { verdict: 'illegal', decidable: true, reason: 'No edge found in this candidate\'s chain' }
    }
    if (firstEdge.edge.kind === 'In' || firstEdge.edge.kind === 'PartOf' || firstEdge.edge.kind === 'On') {
        return { verdict: 'illegal', decidable: true, reason: 'Hosting-kind relation is not supported on the ingress relational route' }
    }
    // A candidate whose Expansion found a chain is legal: the kernel rechecks every leg at commit.
    return { verdict: 'legal', decidable: true, plan: { steps: outcome.steps } }
}

/**
 * Extend's precondition: *this thing has extent*. For now every object these instructions are applied
 * to is assumed to have it (nothing is judged and no trait is read), so this never refuses. It is the
 * one seam where a real judgment (planner, or an authored or improvised trait) replaces the assumption.
 */
const extendPreconditionFailure = (_step: ExtendChange<GroundedReferent>): string | undefined => undefined

/**
 * A `containedBy` assertion's failure reason, or undefined when it holds. The subject's hosts are its one
 * host, else those its view sits under (the read a transfer makes); every one must be the object, so a
 * view that sits only partly under it fails (the whole draped cloth is not "on the table"; its table part is).
 * Lenient for now: direct hosts only, and the relation is not read. `negate` flips the verdict.
 */
const containedByFailure = (step: ContainedByAssertion<GroundedReferent>, env: ExpansionEnvironment): string | undefined => {
    const subjectId = step.subject.groundedId
    if (!isEphemeraObjectId(subjectId)) {
        return objectManipulationErrorMessages.noMembershipHost
    }
    const view = step.subject.referentType === 'objectSpan' ? step.subject.view : undefined
    const actualHost = env.getCurrentHost(subjectId)
    const hosts = actualHost !== undefined ? [actualHost] : view !== undefined ? env.getViewHosts?.(subjectId, view) : undefined
    if (hosts === undefined || hosts.length === 0) {
        return objectManipulationErrorMessages.noMembershipHost
    }
    const held = hosts.every((host) => host === step.object.groundedId)
    if (held === step.negate) {
        const host = labelOf(step.object)
        const subject = labelOf(step.subject)
        return step.negate ? qualifierErrorMessages.negatedUnmet(host, subject) : qualifierErrorMessages.unmet(host, subject)
    }
    return undefined
}

/**
 * The transfer preconditions (ISS8203 slice 3), over a grounded `transferMembership`. Returns the
 * refusal reason for the first one that fails, or undefined when all hold.
 *
 * An object in one host is judged by that host. One in several is judged by its `view`, whose hosts the
 * catalog's placement gives (`getViewHosts`): `from` must be one of them, and the part must not already sit
 * under `to`.
 */
const transferPreconditionFailure = (step: TransferMembershipChange<GroundedReferent>, env: ExpansionEnvironment): string | undefined => {
    const objectId = step.object.groundedId
    if (!isEphemeraObjectId(objectId)) {
        return objectManipulationErrorMessages.noMembershipHost
    }
    const actualHost = env.getCurrentHost(objectId)
    const view = step.object.referentType === 'objectSpan' ? step.object.view : undefined
    // A thing in one host is judged by that host, as ever; only a thing in several needs its view's hosts.
    const viewHosts = actualHost === undefined && view !== undefined ? env.getViewHosts?.(objectId, view) : undefined
    if (viewHosts !== undefined) {
        if (viewHosts.includes(step.to.groundedId as EphemeraMembershipHostId)) {
            return objectManipulationErrorMessages.alreadyHoldingObject
        }
        if (!viewHosts.includes(step.from.groundedId as EphemeraMembershipHostId)) {
            return step.from.referentType === 'actingCharacter'
                ? objectManipulationErrorMessages.notCarryingObject
                : objectManipulationErrorMessages.noMembershipHost
        }
        return undefined
    }
    if (actualHost === undefined) {
        return objectManipulationErrorMessages.noMembershipHost
    }
    if (step.from.groundedId !== actualHost) {
        return step.from.referentType === 'actingCharacter'
            ? objectManipulationErrorMessages.notCarryingObject
            : objectManipulationErrorMessages.noMembershipHost
    }
    if (step.from.groundedId === step.to.groundedId) {
        return objectManipulationErrorMessages.alreadyHoldingObject
    }
    return undefined
}

/**
 * Expansion and Adjudicate for every candidate's transfer (ISS8203 slice 3): a `transferMembership`
 * gets its boundary dissolves, and its exit-contact challenge, from its object's source host graph,
 * whichever template produced it. Then the per-candidate Adjudicate tier judges what it may.
 * A thing in several hosts reads those its view sits under.
 * A candidate missing a source graph is left unexpanded, and its dry run refuses it.
 */
export const expandAndAdjudicateCandidates = (
    candidates: readonly GroundedAttemptCandidate[],
    env: ExpansionEnvironment
): GroundedAttemptCandidate[] => candidates.map((candidate) => {
    const actions = candidate.attempt.actions()
    const primary = actions[actions.length - 1]
    const step = primary?.desiredResult
    // A move of the binding an extend minted leaves nothing: the object stays in the host the binding
    // leaves, so it has no boundary to dissolve and no exit contact to challenge.
    if (primary === undefined || step?.kind !== 'change' || step.primitive !== 'transferMembership'
        || viewMintedByExtend(step.object, planStepsOf(actions))) {
        return candidate
    }
    const objectId = step.object.referentType === 'objectSpan' ? step.object.groundedId : undefined
    if (objectId === undefined || !isEphemeraObjectId(objectId)) {
        return candidate
    }
    // The hosts the object leaves: its one host, else those its view sits under.
    const sourceHost = env.getCurrentHost(objectId)
    const view = step.object.referentType === 'objectSpan' ? step.object.view : undefined
    const sourceHosts = sourceHost !== undefined ? [sourceHost] : (view !== undefined ? env.getViewHosts?.(objectId, view) : undefined) ?? []
    const graphs = sourceHosts.flatMap((hostId) => {
        const graph = env.getGraph(hostId)
        return graph ? [graph] : []
    })
    if (graphs.length === 0 || graphs.length < sourceHosts.length) {
        return candidate
    }
    const expanded = attemptActionsFromTransfer(primary, objectId, graphs, env.getGraph)
    return {
        ...candidate,
        attempt: adjudicateAttempt(CommandAttempt.create(
            candidate.attempt.kind,
            candidate.attempt.words,
            [...actions.slice(0, -1), ...expanded.actions],
            [...candidate.attempt.narrationUnits(), ...expanded.narrationUnits]
        )),
    }
})

/** Every objectSpan referent a step names, including one nested under a `currentHost`. */
const stepSpans = (step: PlanStep): Extract<Referent, { referentType: 'objectSpan' }>[] => {
    if (step.kind === 'assertion') {
        return [step.subject, step.object].flatMap(objectSpansIn)
    }
    if (step.primitive === 'transferMembership') {
        return [step.object, step.from, step.to].flatMap(objectSpansIn)
    }
    if (step.primitive === 'extend') {
        return objectSpansIn(step.object)
    }
    return [step.subject, step.target].flatMap(objectSpansIn)
}
