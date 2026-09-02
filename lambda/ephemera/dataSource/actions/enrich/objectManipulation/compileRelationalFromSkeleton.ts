import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
import type { ObjectManipulationPositionsReadDeps } from './membershipObservation'
import type { ParseSkeleton } from './parse/parseToken'
import type { EstablishRelationStep, DissolveRelationStep } from './parsePlanStep'
import { isDissolveRelationStep, isEstablishRelationStep } from './parsePlanStep'
import { matchRelationalTemplate } from './plan/matchRelationalTemplate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { resolvedSpansFromPools } from './resolvedSpansFromPools'
import { filterLegalRelationalCandidates } from './synthesize/filterLegalRelationalCandidates'
import { walkAncestryContainers } from './synthesize/findShardBoundary'
import { groundChange } from './synthesize/groundChange'
import type { GroundingContext } from './synthesize/groundReferent'
import { createExpansionEnvironment } from './synthesize/expansionEnvironment'
import { runExecutor } from './synthesize/executor'
import type { GroundedSameHostAssertion, WorklistInstruction } from './synthesize/executorTypes'

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
 * The native relational pipeline (see AGENT.md, relational branch, and
 * ../../AGENT.concepts.md's Parse/Plan/Synthesize decomposition) --- Plan match
 * (matchRelationalTemplate) -> Identify (runIdentityStageOverSkeleton) ->
 * Grounding (groundChange) -> Expansion (expandSameHost, BD-16) -> Validation
 * (filterLegalRelationalCandidates) --- replaced the retired frame-extract +
 * selectRelationalFromPools flow on the live relational route.
 *
 * Deliberately has no fallback to that legacy flow: a noMatch/nestingDefer
 * skeleton, or a command Grounding/Validation can't make sense of, abstains or
 * errors outright rather than retrying through frame-extract.
 *
 * Grounding (groundChange.ts) still derives every candidate's host as
 * currentHost(actingCharacter) (BD-6's default) --- that default is discarded,
 * not read, once Expansion runs (Migrate slice, 2026-07-23): per candidate,
 * this seeds the general Synthesize executor with a single grounded `sameHost`
 * instruction (PV1-3b-4 collapsed the seed --- it used to carry a sibling
 * `relationalChange` instruction too, retired unmodified whenever the
 * assertion was satisfied; that contract no longer holds once every case,
 * including same-host, resolves through `findShardBoundary`/
 * `buildCrossingLegs`) and runs it, producing the establish/dissolve step(s)
 * directly as the assertion's own children. A same-host pair resolves to a
 * zero-hop common ancestor and a single portless leg (PV1-3b-8); a genuinely
 * violated peer relation either becomes crossing legs across a real boundary
 * or declines (`defer`) --- PV1-3b-9 (2026-09-01) retired the old
 * `transferMembership` repair outcome entirely, so there is no longer a
 * relocate-then-relate path. `defer` has no Consult/LLM-fallback path on this
 * route yet (unlike membership) and is dropped, same as any other decline.
 * `expandSameHost.ts` itself is not called directly here anymore --- the
 * executor's own `sameHost` command-expansion calls it internally.
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
    const characterId = input.characterId

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

    const context: GroundingContext = {
        actingCharacterId: characterId,
        resolvedSpans: resolvedSpansFromPools(identityResult.spanPools),
        getCurrentHost: (componentId) => (componentId === characterId ? hostRoomId : undefined),
    }

    const groundResult = groundChange(match.change, context)
    if (!groundResult.ok) {
        return { type: 'Abstain', confidence: intentConfidence, reason: groundResult.reason }
    }

    const relationalCandidates = groundResult.candidates.filter(
        (candidate): candidate is EstablishRelationStep | DissolveRelationStep =>
            isEstablishRelationStep(candidate) || isDissolveRelationStep(candidate)
    )
    if (relationalCandidates.length === 0) {
        // matchRelationalTemplate only ever emits establishRelation/dissolveRelation
        // Changes, so groundChange never produces a transferMembership candidate
        // here --- defensive, not reachable via this pipeline today.
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.unimplementedAtomicOperation,
        }
    }

    // BD-16 sameHost (2026-07-21): groundChange still derives every candidate's host as
    // currentHost(actingCharacter) (BD-6's default, unchanged) --- expandSameHost is the
    // Expansion pass that corrects this per-candidate against the subject/object's real
    // current hosts. It once repaired a mismatch by inserting a transferMembership;
    // PV1-3b-9 (2026-09-01) retired that, so it now either walks-then-builds a crossing
    // (findShardBoundary/buildCrossingLegs, PV1-3b-4 --- same-host included, since an
    // endpoint is its own zero-hop ancestor) or declines.
    const distinctObjectIds = new Set<EphemeraObjectId>()
    for (const candidate of relationalCandidates) {
        distinctObjectIds.add(candidate.subjectId)
        distinctObjectIds.add(candidate.targetId)
    }

    // PV1-3b-5: eager, depth-capped (5) async pre-fetch of each distinct candidate's full
    // containment ancestry, not just its one direct container --- `findShardBoundary`'s walk
    // (called synchronously, inside `runExecutor` below) needs to reach *past* intermediate
    // hosts to find a common ancestor further up, and a shallow one-hop fetch dead-ends it at
    // `notFound` even when a real crossing exists. `walkAncestryContainers` mirrors
    // `findShardBoundary.ts`'s own `walkAncestry` traversal shape, async-ified against the real
    // gateway; running one walk per distinct id concurrently is safe with no extra memoization
    // on top --- `PositionsCacheHandler` (`packages/mtw-gateways`) already dedupes concurrent/
    // repeat calls for the same id within this one invocation.
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
        step: EstablishRelationStep | DissolveRelationStep
    }

    const preparedCandidates: PreparedCandidate[] = []
    for (const candidate of relationalCandidates) {
        const sameHostAssertion: GroundedSameHostAssertion = {
            kind: 'assertion',
            predicate: 'sameHost',
            subjectId: candidate.subjectId,
            objectId: candidate.targetId,
            operationKind: candidate.kind,
            // PV1-3b-6: carry the label, not just the kind --- `expandSameHost`'s crossing gate
            // requires it for `Custom`, and this seed used to drop it, so no live `Custom`
            // relation could reach the crossing path at all. Spread as a unit (the same helper
            // the sibling literal below uses) so the `Custom`/enum branch is stated once.
            ...relationKindAndLabelFrom(candidate),
        }
        const seed: WorklistInstruction[] = [
            { id: `${candidate.subjectId}/sameHost`, tag: 'grounded', step: sameHostAssertion },
        ]
        // PV1-3: `expandSameHost` can resolve every peer-kind candidate into a genuine
        // shard-boundary crossing (BD-16's third outcome, PV1-3b-4 generalized it to same-host
        // too) instead of ever needing a second seeded instruction --- the assertion's own
        // children carry the establish/dissolve leg(s) now. PV1-3b-5 deepened the pre-fetch
        // above to a full ancestry walk, so `findShardBoundary` can now reach a common ancestor
        // past an intermediate host and return `crossed` for a genuine cross-shard pair, not just
        // `notFound`. What still keeps a genuine crossing from landing live on this route: below,
        // `outcome.steps.find(...)` takes only the *first* establish/dissolve step, and a real
        // crossing's near-side leg has a port-address endpoint (not an `EphemeraObjectId`), which
        // the `isEphemeraObjectId` guard further down drops --- carrying and committing every leg
        // of a crossing needs PV1-3b-1/2/3/7 (widen the result, build `executeEstablishEdgeChain`),
        // not this route's pre-fetch. A same-host candidate still resolves live end to end, as
        // before (PV1-3b-4's zero/one-hop path is unaffected by the deeper walk).
        // `expandSameHost`/`commandExpand`/`buildCrossingLegs` are unit-tested directly for the
        // deeper cases (`expandSameHost.test.ts`, `executor.test.ts`, `buildCrossingLegs.test.ts`).
        const env = createExpansionEnvironment(getGraph, getCurrentHostForExpansion, getMembershipContainersForExpansion)
        const outcome = runExecutor(seed, env, context)

        // `defer`/`error`: this route has no Consult/LLM-fallback path today (unlike
        // membership) --- drop the candidate, same as any other Grounding/Validation
        // decline. `defer` is the known gap iteration 2's plan-only/joint fallback
        // work is meant to eventually close.
        if (outcome.verdict !== 'legal') {
            continue
        }

        const relStep = outcome.steps.find(
            (step): step is Extract<typeof step, { kind: 'establishRelation' | 'dissolveRelation' }> =>
                step.kind === 'establishRelation' || step.kind === 'dissolveRelation'
        )
        if (!relStep) {
            continue
        }

        // LP4g widened the executor's relational step terminals to EphemeraLudicTerminalPrimitive,
        // but this ingress-facing route's own step shape (EstablishRelationStep/DissolveRelationStep,
        // parsePlanStep.ts) stays EphemeraObjectId-typed by design (LD-13: containment/non-Object
        // relational language is a persistence-layer concern, not an ingress one). No candidate this
        // route grounds is anything but an Object today, so this is a narrow, not a design change ---
        // same drop-the-candidate idiom the `verdict !== 'legal'` branch above already uses.
        // PV1-3 widened the step terminals again to EphemeraLudicTerminalId (port addresses, for
        // crossing legs) --- this route never produces one, so the `typeof === 'string'` check
        // drops a port-address endpoint the same way it already drops a non-Object primitive.
        if (
            typeof relStep.subjectId !== 'string' || typeof relStep.targetId !== 'string'
            || !isEphemeraObjectId(relStep.subjectId) || !isEphemeraObjectId(relStep.targetId)
        ) {
            continue
        }
        // LP4c-i: HostRelationalEdgeKind widened (ephemeraMeta.ts) to admit containment ('In'/
        // 'PartOf'), but this ingress-facing route's relationKind stays the narrow set
        // (LD-13, parsePlanStep.ts) --- same drop-the-candidate idiom as the endpoint guard above.
        // Unreachable today: no ingress path can produce a containment relStep (isContainmentSpan
        // routes to nestingDefer before this point). **`On` joined this guard 2026-08-22**
        // (Channel D, CD2, reduced scope): it is a hosting kind too now, deferred at ingress the
        // same way, and equally unreachable here. **`Present` joined 2026-08-22** (presence plan
        // PR-4): it's not a WML-authorable kind either --- an internal port/cover mechanism, never
        // an establishRelation/dissolveRelation target --- so it's deferred at ingress the same way.
        if (relStep.relationKind === 'In' || relStep.relationKind === 'PartOf' || relStep.relationKind === 'On' || relStep.relationKind === 'Present') {
            continue
        }

        const hostId = getCurrentHostForExpansion(candidate.subjectId)
        if (hostId === undefined) {
            continue
        }

        const correctedStep: EstablishRelationStep | DissolveRelationStep = {
            kind: relStep.kind,
            subjectId: relStep.subjectId,
            targetId: relStep.targetId,
            // Inlined rather than routed through `relationKindAndLabelFrom`: the guard above
            // narrowed `relStep` to the ingress-lane kinds, and the shared helper's wide return
            // type would discard exactly that narrowing.
            ...(relStep.relationKind === 'Custom'
                ? { relationKind: 'Custom' as const, relationLabel: relStep.relationLabel }
                : { relationKind: relStep.relationKind }),
            hostRoomId: hostId,
        }

        // Validate legality (bothObjectsOnGraph + On/Under cycle detection, BD-23 step 5)
        // against the real current graph. This route once also validated against a *simulated*
        // post-transfer graph, for the repair outcome that moved the subject onto the target's
        // host; PV1-3b-9 (2026-09-01) retired that outcome, so there is no longer a candidate
        // whose legality depends on a move that has not happened yet.
        const validationGraph = getGraph(hostId)

        const legalResult = filterLegalRelationalCandidates([correctedStep], {
            getGraph: (lookupHostId) => (lookupHostId === hostId ? validationGraph : undefined),
        })
        if (!legalResult.ok || legalResult.candidates.length === 0) {
            continue
        }

        preparedCandidates.push({ step: correctedStep })
    }

    if (preparedCandidates.length === 0) {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: 'No relational candidate in the pool passed Validation legality checks',
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
    const chosen = preparedCandidates[0]

    return {
        type: 'EstablishRelation',
        operationKind: chosen.step.kind,
        subjectId: chosen.step.subjectId,
        targetId: chosen.step.targetId,
        ...(chosen.step.relationKind === 'Custom'
            ? { relationKind: 'Custom' as const, relationLabel: chosen.step.relationLabel }
            : { relationKind: chosen.step.relationKind }),
        hostId: chosen.step.hostRoomId,
        confidence: intentConfidence,
    }
}
