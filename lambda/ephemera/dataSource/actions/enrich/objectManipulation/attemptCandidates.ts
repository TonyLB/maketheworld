import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'
import { objectSpansIn } from '../../commandAttempt/referent'
import { NarrateAttemptAction, PositionAttemptAction, type AttemptAction } from '../../commandAttempt/action'
import { CommandAttempt } from '../../commandAttempt'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { enumerateIdentityAssignments } from './enumerateIdentityAssignments'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { GroundedId, GroundedReferent, PlanStep, Referent } from './plan/planStep'
import { buildReferentAssignment } from './synthesize/buildReferentAssignment'
import { groundChange } from './synthesize/groundChange'
import { runExecutor, seedFromGroundedSteps } from './synthesize/executor'
import type { ExecutorRelationalChain, ExpansionEnvironment } from './synthesize/executorTypes'
import { walkAncestryContainers } from './synthesize/findShardBoundary'
import type { SpanName } from './stampCandidateReferents'
import type { ConsultAlternative, ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { DryRunOutcome } from './validatePlanDryRun'

/**
 * The shared producer for the skeleton routes (ISS8203 slice 2): relational, containment and
 * describe. Each route's Plan attempt goes through one Identify, one Enumerate, one Ground and
 * describe pass, then one dry run and one selection. The route keeps only its own entry checks
 * and its result arm (slice 4 collapses those arms).
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
}

export type ProposeAttemptCandidatesResult =
    | { ok: true; candidates: GroundedAttemptCandidate[] }
    | { ok: false; reason: string }

export type ProposeAttemptCandidatesInput = {
    command: string
    attempts: readonly CommandAttempt[]
    spanPools: ReadonlyMap<string, SpanCandidatePool>
    catalog: readonly ObjectManipulationCatalogEntry[]
    /** Abstain wording when no joint assignment survives Enumerate (route-specific, as today). */
    noAssignmentReason: string
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

/** The distinct stableRefKeys the attempts name, in first-appearance order: Identify's key set. */
export const attemptSpanKeys = (attempts: readonly CommandAttempt[]): string[] =>
    distinctSpanReferents(attempts).map((span) => span.stableRefKey!)

/** The stableRefKeys one action names, distinct: the set that must resolve to distinct ids. */
const actionSpanKeys = (action: AttemptAction): string[] => [
    ...new Set(action.referents().flatMap(objectSpansIn).map((span) => span.stableRefKey).filter((key): key is string => key !== undefined)),
]

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

/**
 * Describes one grounded action: its prose description and its Consult wording (PI-2's describer,
 * one per desired-result kind). Keeps today's strings exactly, so the published attempt is unchanged.
 */
const describeGroundedAction = (action: AttemptAction): { action: AttemptAction; alternative: ConsultAlternative } => {
    if (action instanceof NarrateAttemptAction) {
        const [referent] = action.referents()
        if (referent === undefined) {
            throw new Error('attemptCandidates: a narration action names no referent')
        }
        const label = labelOf(referent)
        const description = `Look at the ${label}`
        return {
            action: new NarrateAttemptAction(action.challenges(), description, action.referents()),
            alternative: { objectId: groundedObjectIdOf(referent), label, proposedCommand: `look at the ${label}` },
        }
    }
    if (!(action instanceof PositionAttemptAction) || action.desiredResult === undefined) {
        throw new Error('attemptCandidates: a position action has no desired result')
    }
    const step = action.desiredResult
    if (step.kind !== 'change') {
        throw new Error('attemptCandidates: assertion steps are not produced by the skeleton routes')
    }
    if (step.primitive === 'transferMembership') {
        if (step.containment === undefined) {
            throw new Error('attemptCandidates: a transferMembership without containment is a membership move, not a skeleton-route move')
        }
        const subject = labelOf(step.object)
        const target = labelOf(step.to)
        const preposition = step.containment === 'On' ? 'on' : 'in'
        return {
            action: new PositionAttemptAction(action.challenges(), step, `Put ${subject} ${preposition} ${target}`),
            alternative: { label: `${subject} / ${target}`, proposedCommand: `put the ${subject} ${preposition} the ${target}` },
        }
    }
    if (step.primitive === 'establishRelation' || step.primitive === 'dissolveRelation') {
        const subject = labelOf(step.subject)
        const target = labelOf(step.target)
        const label = `${subject} / ${target}`
        if (step.primitive === 'dissolveRelation') {
            return {
                action: new PositionAttemptAction(action.challenges(), step, `Dissolve relation: ${label}`),
                alternative: { label, proposedCommand: `separate the ${subject} from the ${target}` },
            }
        }
        const preposition = step.relationKind === 'Custom' ? step.relationLabel : step.relationKind.toLowerCase()
        return {
            action: new PositionAttemptAction(action.challenges(), step, `Establish relation: ${label}`),
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
    const pools = new Map<string, readonly ObjectSpanCandidate[]>()
    for (const span of distinctSpanReferents(input.attempts)) {
        const key = span.stableRefKey!
        const pool = input.spanPools.get(key)
        if (!pool) {
            return { ok: false, reason: `No resolution supplied for stableRefKey "${key}"` }
        }
        // identityFromSpanCandidate (via enumerateIdentityAssignments) throws on a non-Object id.
        const candidates = (pool.shortlist ?? pool.candidates).filter((candidate) => isEphemeraObjectId(candidate.id))
        if (candidates.length === 0) {
            return { ok: false, reason: `No candidates found for span "${pool.span}"` }
        }
        pools.set(key, candidates)
    }
    for (const action of input.attempts.flatMap((attempt) => attempt.actions())) {
        for (const referent of action.referents().flatMap(objectSpansIn)) {
            if (referent.stableRefKey === undefined) {
                return { ok: false, reason: `objectSpan referent for span "${referent.span}" has no stableRefKey to ground against` }
            }
        }
    }

    // A step's distinct span keys must bind distinct objects: "put cup on cup" is never a candidate,
    // and that rule is the same for every route (it is the case stableRefKey exists for).
    const actions = input.attempts.flatMap((attempt) => attempt.actions())
    const assignments = enumerateIdentityAssignments(pools).filter(({ identities }) => actions.every((action) => {
        const objectIds = actionSpanKeys(action).map((key) => identities.get(key)?.objectId)
        return new Set(objectIds).size === objectIds.length
    }))
    if (assignments.length === 0) {
        return { ok: false, reason: input.noAssignmentReason }
    }

    const candidates = assignments.map(({ identities, confidence }): GroundedAttemptCandidate => {
        const names = new Map<string, SpanName>()
        for (const [key, identity] of identities) {
            const entry = input.catalog.find((catalogEntry) => catalogEntry.objectId === identity.objectId)
            names.set(key, {
                id: identity.objectId,
                shortName: entry?.normalizedShortName ?? identity.objectId,
                gloss: entry?.gloss,
            })
        }
        const described = actions.map((action) => describeGroundedAction(action.grounded(names)))
        const primary = described[described.length - 1]!
        return {
            attempt: CommandAttempt.create(input.command, described.map((entry) => entry.action)),
            confidence,
            alternative: primary.alternative,
        }
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
 * The per-command environment (PI-3): the room graph, plus each candidate object's host graph
 * found by an eager, depth-capped ancestry walk. Built once for the whole pool. A
 * `findShardBoundary` walk reaches past intermediate hosts, so one-hop lookups would dead-end.
 */
export const buildAttemptEnvironment = async (
    candidates: readonly GroundedAttemptCandidate[],
    hostRoomId: EphemeraRoomId,
    roomGraph: EphemeraLudicGraph | undefined,
    reads: AttemptPositionsReads
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
    const hostGraphMap = new Map<EphemeraMembershipHostId, EphemeraLudicGraph | undefined>([[hostRoomId, roomGraph]])
    for (const hostId of hostByObjectId.values()) {
        if (!hostGraphMap.has(hostId)) {
            hostGraphMap.set(hostId, await reads.getLudicGraph(hostId))
        }
    }

    return {
        getGraph: (hostId) => hostGraphMap.get(hostId),
        getCurrentHost: (objectId) => hostByObjectId.get(objectId),
        getMembershipContainers: (id) => containersByHostId.get(id) ?? [],
    }
}

/**
 * The shared dry run (PI-3): grounds each position step in full (derived referents such as
 * containment's `currentHost(subject)` resolve against the environment), seeds the executor with
 * every grounded step and runs it. Narration has no steps, so it is `legal` with nothing to run
 * (a look has no preconditions and no mutation).
 */
export const attemptDryRun = (candidate: GroundedAttemptCandidate, env: ExpansionEnvironment | undefined): DryRunOutcome => {
    const steps = candidate.attempt.actions().flatMap((action) => action.desiredResult ? [action.desiredResult] : [])
    if (steps.length === 0) {
        return { verdict: 'legal', decidable: true }
    }
    if (env === undefined) {
        throw new Error('attemptDryRun: a position step needs the per-command environment')
    }

    const seeds: PlanStep<GroundedReferent>[] = []
    for (const step of steps) {
        if (step.kind !== 'change') {
            throw new Error('attemptDryRun: assertion steps are not produced by the skeleton routes')
        }
        const spans = new Map<string, GroundedId>()
        for (const span of stepSpans(step)) {
            if (span.stableRefKey !== undefined && span.groundedId !== undefined) {
                spans.set(span.stableRefKey, span.groundedId)
            }
        }
        const assignment = buildReferentAssignment(step, spans, {
            actingCharacter: undefined,
            currentHost: (id) => (isEphemeraObjectId(id) ? env.getCurrentHost(id) : undefined),
        })
        if (assignment === undefined) {
            return { verdict: 'illegal', decidable: true, reason: objectManipulationErrorMessages.noMembershipHost }
        }
        seeds.push(groundChange(step, assignment))
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

/** Every objectSpan referent a step names, including one nested under a `currentHost`. */
const stepSpans = (step: PlanStep): Extract<Referent, { referentType: 'objectSpan' }>[] => {
    if (step.kind === 'assertion') {
        return [step.subject, step.object].flatMap(objectSpansIn)
    }
    if (step.primitive === 'transferMembership') {
        return [step.object, step.from, step.to].flatMap(objectSpansIn)
    }
    return [step.subject, step.target].flatMap(objectSpansIn)
}
