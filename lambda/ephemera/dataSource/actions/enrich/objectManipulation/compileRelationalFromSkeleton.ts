import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import type {
    ParseCommandAbstainResult,
    ParseCommandErrorResult,
    ParseCommandEstablishRelationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import { enumerateIdentityAssignments } from './enumerateIdentityAssignments'
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { ParseSkeleton } from './parse/parseToken'
import type { PeerRelationalEdgeKind } from './relationKind'
import { matchRelationalTemplate } from './plan/matchRelationalTemplate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { walkAncestryContainers } from './synthesize/findShardBoundary'
import { runExecutor, seedFromGroundedSteps } from './synthesize/executor'
import type { ExecutorRelationalChain, ExpansionEnvironment } from './synthesize/executorTypes'
import { lowerRelationalChain } from './synthesize/buildCrossingLegs'
import { groundStepBySubstitution, type Change, type EstablishRelationChange, type DissolveRelationChange, type GroundedId, type GroundedReferent, type Referent } from './plan/planStep'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import type { ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'
import { buildCommandAttemptReferent } from '../../commandAttempt/referent'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { CommandAttempt } from '../../commandAttempt'

export type CompileRelationalFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileRelationalFromSkeletonDeps = IdentityStageDeps & {
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileRelationalFromSkeletonResult =
    | ParseCommandEstablishRelationResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

const defaultPositionsReadDeps = (): ObjectManipulationPositionsReadDeps => ({
    getMembershipContainers: (objectId) => internalCache.Positions.getMembershipContainers(objectId),
    getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
})

/**
 * The candidate's edge, as published: two Objects and a relation, with no host --- a host
 * belongs to each leg of its chain (AP-6), and the published host comes from each
 * leg's own `hostId`. `relationKind`/`relationLabel` stay the narrow ingress-lane set
 * (`PeerRelationalEdgeKind`, `relationKind.ts`, BD-2's kind-narrowing clause); `proposeRelationalCandidates`
 * rejects a containment kind before building one.
 */
type RelationalCandidateId = {
    kind: 'establishRelation' | 'dissolveRelation'
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
} & RelationalKindAndLabel<PeerRelationalEdgeKind>

/**
 * One producer candidate (AP-1's stage sketch, slice 2a): a joint identity assignment
 * (one id per `stableRefKey` in `match.change`), the `Change` grounded against it by
 * substitution, and the attempt built from that grounded change --- before Expand,
 * before the dry run, before selection. Mirrors `MembershipPlanCandidate`
 * (`selectPlanCandidate.ts`), minus the generic `PlanCandidate` wiring: this route
 * doesn't reach the shared `selectPlanTuple` stage yet (that's slice 2d).
 */
type RelationalGroundedCandidate = {
    candidateId: RelationalCandidateId
    /** Grounded by substitution: `subject`/`target` carry `groundedId`. A relational
     * `Change` has no `host`: where the relation lives is Expansion's question. */
    change: EstablishRelationChange | DissolveRelationChange
    confidence: number
    attempt: CommandAttempt
}

type ProposeRelationalCandidatesResult =
    | { ok: true; candidates: RelationalGroundedCandidate[] }
    /** `abstain` reasons match what `groundChange`'s product used to report for the same
     * inputs, so the published `Abstain` is unchanged. */
    | { ok: false; outcome: 'abstain' | 'error'; reason: string }

const groundedObjectId = (referent: Referent): EphemeraObjectId => {
    const id = referent.groundedId
    if (id === undefined || !isEphemeraObjectId(id)) {
        // groundStepBySubstitution always grounds subject/target when the assignment
        // covers both of match.change's stableRefKeys, which the producer below
        // guarantees --- reaching here is a construction bug.
        throw new Error('compileRelationalFromSkeleton: expected a grounded Object id on a relational candidate\'s subject/target referent')
    }
    return id
}

/**
 * The producer's half of AP-1's ground + expand split (mirrors
 * `proposeMembershipCandidates.ts`/`groundMembershipCandidate`): one identity pool per
 * `match.change`'s own `stableRefKey`s (subject, then target --- the step's field
 * order), filtered to Object candidates (`identityFromSpanCandidate` throws on anything
 * else), enumerated into joint assignments (`enumerateIdentityAssignments`, AP-2's `min`
 * confidence), each grounded by substitution (`groundStepBySubstitution`) and wrapped in
 * an attempt --- one primary action, no boundary challenges, since establishing or
 * dissolving a peer edge is not a membership transfer and this route detects no graph
 * challenge today (`AGENT.concepts.md`'s `CommandAttempt` section).
 */
const proposeRelationalCandidates = (
    change: Change,
    spanPools: ReadonlyMap<string, SpanCandidatePool>,
    words: string,
    catalog: readonly ObjectManipulationCatalogEntry[]
): ProposeRelationalCandidatesResult => {
    if (change.primitive === 'transferMembership') {
        // matchRelationalTemplate only ever emits establishRelation/dissolveRelation Changes.
        return { ok: false, outcome: 'error', reason: objectManipulationErrorMessages.unimplementedAtomicOperation }
    }

    type KeyedPool = { ok: true; key: string; candidates: readonly ObjectSpanCandidate[] } | { ok: false; reason: string }
    const keyedPool = (referent: Referent): KeyedPool => {
        if (referent.referentType !== 'objectSpan' || referent.stableRefKey === undefined) {
            const span = referent.referentType === 'objectSpan' ? referent.span : referent.referentType
            return { ok: false, reason: `objectSpan referent for span "${span}" has no stableRefKey to ground against` }
        }
        const key = referent.stableRefKey
        const pool = spanPools.get(key)
        if (!pool) {
            return { ok: false, reason: `No resolution supplied for stableRefKey "${key}"` }
        }
        const candidates = pool.shortlist ?? pool.candidates
        if (candidates.length === 0) {
            return { ok: false, reason: `No candidates found for span "${pool.span}"` }
        }
        // `identityFromSpanCandidate` throws on a non-Object id, so filter before enumerating.
        return { ok: true, key, candidates: candidates.filter((candidate) => isEphemeraObjectId(candidate.id)) }
    }
    const subjectPool = keyedPool(change.subject)
    if (!subjectPool.ok) {
        return { ok: false, outcome: 'abstain', reason: subjectPool.reason }
    }
    const targetPool = keyedPool(change.target)
    if (!targetPool.ok) {
        return { ok: false, outcome: 'abstain', reason: targetPool.reason }
    }

    if (change.relationKind === 'In' || change.relationKind === 'PartOf' || change.relationKind === 'On') {
        // isContainmentSpan routes hosting kinds to nestingDefer before a Change reaches here.
        return { ok: false, outcome: 'abstain', reason: 'Containment relation kinds are not yet groundable as establishRelation/dissolveRelation steps' }
    }
    // Narrowed to `PeerRelationalEdgeKind` by the guard above. Substitution rewrites only
    // referents, so every candidate shares this value.
    const relationKindAndLabel = change.relationKind === 'Custom'
        ? { relationKind: 'Custom' as const, relationLabel: change.relationLabel }
        : { relationKind: change.relationKind }

    // Subject first, then target: the step's field order, which keeps the old product's order.
    const subjectKey = subjectPool.key
    const targetKey = targetPool.key
    // A relation joins two different things, for every kind (AP-12): an assignment that
    // grounds subject and target to the same object is never a candidate.
    const assignments = enumerateIdentityAssignments(new Map([
        [subjectKey, subjectPool.candidates],
        [targetKey, targetPool.candidates],
    ])).filter(({ identities }) => identities.get(subjectKey)?.objectId !== identities.get(targetKey)?.objectId)
    if (assignments.length === 0) {
        return { ok: false, outcome: 'abstain', reason: 'No combination of two distinct grounded objects produced a well-typed establishRelation/dissolveRelation step' }
    }

    const candidates = assignments.map(({ identities, confidence }) => {
        const groundedIdByRefKey = new Map<string, GroundedId>(
            [...identities].map(([key, identity]) => [key, identity.objectId])
        )
        const groundedChange = groundStepBySubstitution(change, groundedIdByRefKey) as EstablishRelationChange | DissolveRelationChange
        const subjectId = groundedObjectId(groundedChange.subject)
        const targetId = groundedObjectId(groundedChange.target)

        const candidateId: RelationalCandidateId = {
            kind: groundedChange.primitive,
            subjectId,
            targetId,
            ...relationKindAndLabel,
        }

        const subjectEntry = catalog.find((entry) => entry.objectId === subjectId)
        const targetEntry = catalog.find((entry) => entry.objectId === targetId)
        const subjectName = subjectEntry?.normalizedShortName ?? subjectId
        const targetName = targetEntry?.normalizedShortName ?? targetId
        const verbDescription = groundedChange.primitive === 'establishRelation' ? 'Establish relation' : 'Dissolve relation'
        const action = new PositionAttemptAction(
            [],
            groundedChange,
            `${verbDescription}: ${subjectName} / ${targetName}`
        )
        const attempt = CommandAttempt.create(
            words,
            [
                buildCommandAttemptReferent(subjectKey, subjectId, subjectName, subjectEntry?.gloss),
                buildCommandAttemptReferent(targetKey, targetId, targetName, targetEntry?.gloss),
            ],
            [action]
        )

        return { candidateId, change: groundedChange, confidence, attempt }
    })
    return { ok: true, candidates }
}

/**
 * The native relational pipeline (see AGENT.md, relational branch, and
 * ../../AGENT.concepts.md's Parse/Plan/Synthesize decomposition) --- Plan match
 * (matchRelationalTemplate) -> Identify (runIdentityStageOverSkeleton) -> the
 * producer (proposeRelationalCandidates: joint assignments, grounding by
 * substitution, the attempt built per candidate) -> Expansion (expandSameHost, BD-16,
 * reached through a per-candidate `sameHost` seed) --- replaced the retired frame-extract +
 * selectRelationalFromPools flow on the live relational route. A candidate whose Expansion
 * finds a chain is legal; the kernel rechecks every leg at commit.
 *
 * Deliberately has no fallback to that legacy flow: a noMatch/nestingDefer
 * skeleton, or a command Grounding or Expansion can't make sense of, abstains or
 * errors outright rather than retrying through frame-extract.
 *
 * Each candidate's grounded `Change` still carries Plan's `host: currentHost(actingCharacter)`
 * (BD-6's default), and nothing reads it: each candidate seeds the executor with a
 * grounded `sameHost` instruction built from its subject/target ids, so Expansion
 * (`expandSameHost`/`findShardBoundary`/`buildCrossingLegs`) derives the real host from
 * ancestry. A same-host pair resolves to a zero-hop common ancestor
 * and a single portless leg; a genuinely violated peer relation either becomes crossing
 * legs across a real boundary or declines (`defer`) --- the old `transferMembership`
 * repair outcome was retired entirely, 2026-09-01, so there is no longer a
 * relocate-then-relate path. `defer` has no Consult/LLM-fallback path on this route yet
 * (unlike membership) and is dropped, same as any other decline.
 */
export async function compileRelationalFromSkeleton(
    input: CompileRelationalFromSkeletonInput,
    intentConfidence: number,
    deps: CompileRelationalFromSkeletonDeps = {}
): Promise<CompileRelationalFromSkeletonResult> {
    const match = matchRelationalTemplate(input.skeleton)
    if (match.type === 'nestingDefer') {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        }
    }
    if (match.type === 'noMatch') {
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

    const positionsReadDeps = deps.positionsReadDeps ?? defaultPositionsReadDeps()
    const roomGraph = await positionsReadDeps.getLudicGraph(hostRoomId)
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

    const identityResult = await runIdentityStageOverSkeleton(input.command, input.skeleton, catalog, deps)
    if (identityResult.type === 'error') {
        return { type: 'Error', errorMessage: identityResult.errorMessage }
    }

    const proposed = proposeRelationalCandidates(match.change, identityResult.spanPools, input.command, catalog)
    if (!proposed.ok) {
        return proposed.outcome === 'error'
            ? { type: 'Error', errorMessage: proposed.reason }
            : { type: 'Abstain', confidence: intentConfidence, reason: proposed.reason }
    }
    const groundedCandidates = proposed.candidates

    // eager, depth-capped (5) async pre-fetch of each distinct candidate's full
    // containment ancestry, not just its one direct container --- `findShardBoundary`'s walk
    // (called synchronously, inside `runExecutor` below) needs to reach *past* intermediate
    // hosts to find a common ancestor further up, and a shallow one-hop fetch dead-ends it at
    // `notFound` even when a real crossing exists. `walkAncestryContainers` mirrors
    // `findShardBoundary.ts`'s own `walkAncestry` traversal shape, async-ified against the real
    // gateway; running one walk per distinct id concurrently is safe with no extra memoization
    // on top --- `PositionsCacheHandler` (`packages/mtw-gateways`) already dedupes concurrent/
    // repeat calls for the same id within this one invocation.
    const distinctObjectIds = new Set<EphemeraObjectId>()
    for (const candidate of groundedCandidates) {
        distinctObjectIds.add(candidate.candidateId.subjectId)
        distinctObjectIds.add(candidate.candidateId.targetId)
    }

    const getMembershipContainersForWalk = (
        id: EphemeraPositionAdjacencyContainedId
    ): Promise<EphemeraMembershipHostId[]> =>
        // This route's candidates, and everything their ancestry walk can reach, are Objects
        // until a Room/Area terminates the branch (`isPositionAdjacencyContainedId` already
        // gates those out of the walk before this is called) --- `getMembershipContainers`
        // is Object-typed to match, same narrowing `getMembershipContainersForExpansion` below
        // already relied on before this slice.
        positionsReadDeps.getMembershipContainers(id as EphemeraObjectId)

    const containersByHostId = new Map<EphemeraMembershipHostId, EphemeraMembershipHostId[]>()
    const ancestryMaps = await Promise.all(
        [...distinctObjectIds].map((objectId) => walkAncestryContainers(objectId, getMembershipContainersForWalk))
    )
    ancestryMaps.forEach((ancestryMap) => ancestryMap.forEach((containers, hostId) => {
        containersByHostId.set(hostId, containers)
    }))

    const hostByObjectId = new Map<EphemeraObjectId, EphemeraMembershipHostId>()
    for (const objectId of distinctObjectIds) {
        const containers = containersByHostId.get(objectId)
        if (containers?.length === 1) {
            hostByObjectId.set(objectId, containers[0])
        }
    }
    const getCurrentHostForExpansion = (objectId: EphemeraObjectId): EphemeraMembershipHostId | undefined =>
        hostByObjectId.get(objectId)
    const getMembershipContainersForExpansion = (id: EphemeraPositionAdjacencyContainedId): EphemeraMembershipHostId[] =>
        containersByHostId.get(id) ?? []

    const hostGraphMap = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[hostRoomId, roomGraph]])
    for (const hostId of hostByObjectId.values()) {
        if (!hostGraphMap.has(hostId)) {
            hostGraphMap.set(hostId, await positionsReadDeps.getLudicGraph(hostId))
        }
    }
    const getGraph = (hostId: EphemeraMembershipHostId): EphemeraLudicGraph | undefined => hostGraphMap.get(hostId)

    type PreparedCandidate = {
        // The grounded candidate's own id/relationKind data --- always a plain
        // Object-to-Object pair, unlike a crossing's own leg endpoints. Source for the
        // widened result's flat subjectId/targetId/operationKind/relationKind fields.
        candidateId: RelationalCandidateId
        attempt: CommandAttempt
        // The candidate's expanded chain, still a value (AP-6): lowered to kernel steps only
        // once a candidate is chosen.
        chain: ExecutorRelationalChain
    }

    const preparedCandidates: PreparedCandidate[] = []
    for (const candidate of groundedCandidates) {
        const env: ExpansionEnvironment = {
            getGraph,
            getCurrentHost: getCurrentHostForExpansion,
            getMembershipContainers: getMembershipContainersForExpansion,
        }
        // The grounded edge itself seeds directly (AP-6): command-expansion dispatches on
        // its `primitive` and finds its chain (`findShardBoundary` for establish,
        // `findRelationalChain` for dissolve), the same mechanism every relational edge now uses.
        const seed = seedFromGroundedSteps([candidate.change as EstablishRelationChange<GroundedReferent> | DissolveRelationChange<GroundedReferent>])
        const outcome = runExecutor(seed, env)

        // `defer`/`error`: this route has no Consult/LLM-fallback path today (unlike
        // membership) --- drop the candidate, same as any other Grounding or Expansion
        // decline. `defer` is the known gap iteration 2's plan-only/joint fallback
        // work is meant to eventually close.
        if (outcome.verdict !== 'legal') {
            continue
        }

        // The one edge seeded retires as its one chain.
        const chain = outcome.steps.find((step): step is ExecutorRelationalChain => step.kind === 'relationalChain')
        if (chain === undefined) {
            continue
        }

        // HostRelationalEdgeKind was widened (ephemeraMeta.ts) to admit containment ('In'/
        // 'PartOf'), but this ingress-facing route's relationKind stays the narrow set
        // (BD-2's kind-narrowing clause, relationKind.ts) --- same drop-the-candidate
        // idiom as the `verdict !== 'legal'` branch above. Read off the chain, not
        // `candidate`: `candidate` is already narrowly typed (`PeerRelationalEdgeKind`,
        // relationKind.ts) and cannot literally hold a hosting kind, but the chain's edges carry
        // the wide `HostRelationalEdgeKind`, and `buildCrossingLegs` mints every edge of a chain
        // from the same kind and label, so checking the first suffices. Unreachable today: no
        // ingress path can produce a containment candidate (isContainmentSpan routes to
        // nestingDefer before this point). **`On` joined this guard 2026-08-22** (Channel D,
        // CD2, reduced scope): it is a hosting kind too now, deferred at ingress the same way,
        // and equally unreachable here. **`Present` joined 2026-08-22** (presence plan PR-4)
        // and **left 2026-09-17+ (presenceNodes Slice 3, PN-14):** it was never a
        // WML-authorable kind, and is now not a `HostRelationalEdgeKind` member at all, so the
        // comparison would be dead code rather than a defensive check --- the type itself now
        // does what this guard used to do for that one kind.
        const firstEdge = chain.steps.find((step) => step.type === 'edge')
        if (firstEdge === undefined || firstEdge.type !== 'edge') {
            continue
        }
        if (firstEdge.edge.kind === 'In' || firstEdge.edge.kind === 'PartOf' || firstEdge.edge.kind === 'On') {
            continue
        }

        // A candidate whose Expansion found a chain is legal: there is no construction-time
        // Validation on this route (AP-11, AP-12). The kernel rechecks every leg against
        // locked live state at commit.
        preparedCandidates.push({ candidateId: candidate.candidateId, attempt: candidate.attempt, chain })
    }

    if (preparedCandidates.length === 0) {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: 'No relational candidate in the pool found a chain',
        }
    }

    // Naive placeholder selection (2026-07-19, unchanged by BD-16): rank/confidence-based
    // selection among multiple legal candidates is deliberately deferred (BD-25 --- see the
    // BD-N index in taskPlanning/.../AGENT.objectManipulationIterations.planning.md,
    // which routes to iteration 2) --- once the
    // evidence-weighting work generalizes to this deterministic path, this
    // should combine each candidate's grounded Identify confidence
    // (ObjectSpanCandidate.jointRelevance) with a plan-suitability rubric
    // (simplicity, limited Carry/auto-resolves, Room-over-Character-inventory
    // preference) and commit only past a real front-runner threshold, rather
    // than just taking the first legal candidate.
    const chosen = preparedCandidates[0]!

    // sourced from the grounded candidate's own id, not a step --- always plain
    // Object-to-Object, unlike a crossing's own leg endpoints.
    return {
        type: 'EstablishRelation',
        operationKind: chosen.candidateId.kind,
        subjectId: chosen.candidateId.subjectId,
        targetId: chosen.candidateId.targetId,
        ...(chosen.candidateId.relationKind === 'Custom'
            ? { relationKind: 'Custom' as const, relationLabel: chosen.candidateId.relationLabel }
            : { relationKind: chosen.candidateId.relationKind }),
        confidence: intentConfidence,
        // Lowered once, for the chosen candidate only (AP-6).
        steps: lowerRelationalChain(chosen.chain.steps, chosen.chain.operationKind),
        attempt: chosen.attempt.toJSON(),
    }
}
