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
import type { ExecutorDissolveRelationStep, ExecutorEstablishRelationStep, GroundedSameHostAssertion, WorklistInstruction } from './synthesize/executorTypes'
import type { MutationKernelStep } from '../../../positions/manipulation/kernel/kernelStep'

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
        // The original grounded candidate --- always a plain Object-to-Object pair,
        // unlike a crossing's own leg endpoints. Source for the widened result's flat
        // subjectId/targetId/operationKind/relationKind fields (PV1-3b-1).
        candidate: EstablishRelationStep | DissolveRelationStep
        steps: MutationKernelStep[]
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
        // `notFound`. PV1-3b-1 wired the rest: this route now carries every step of a genuine
        // crossing (not just the first) into the widened `ParseCommandEstablishRelationResult`,
        // rather than dropping the candidate --- see below.
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

        // PV1-3b-1: carry every relational step of the outcome, not just the first --- a
        // genuine crossing needs its hop leg(s) *and* the final chain step, plus the
        // `addCrossingPort` step(s) that live on `extraKernelSteps` (a split that exists only
        // inside `runExecutor`'s own worklist-vs-side-channel plumbing). `outcome.steps` is
        // `ExecutorParsePlanStep`-typed --- wider than `MutationKernelStep` (it also admits
        // `TransferMembershipStep`/`ExecutorDescribeStep`, neither reachable from this route's
        // `sameHost`-only seed, per the existing `verdict !== 'legal'`-style drop-the-candidate
        // idiom) --- so it's filtered to establish/dissolve first, same as `executor.ts`'s own
        // `commandExpand` already does when it splits `buildCrossingLegs`'s combined output.
        // Order is not arbitrary: `buildCrossingLegs.ts` mints each hop's `addCrossingPort`
        // step immediately before the leg that references it, then appends the final chain
        // step last (`[port, leg, ..., final]`); `commandExpand` splits that by kind into
        // `outcome.steps` (legs/final) and `outcome.extraKernelSteps` (ports), discarding the
        // per-hop interleaving. Within today's <=1-hop-per-side scope there is at most one
        // port and it always precedes the one leg that needs it, so prepending every port step
        // ahead of every relational step reconstructs the true order exactly. **Not general**:
        // this reconstruction relies on the <=1-hop-per-side scope cut (`buildCrossingLegs`'s
        // own guard) and would need revisiting if PV1-6 generalizes to chains on both sides at
        // once, where a port and a leg could need to interleave more than once.
        const relSteps = outcome.steps.filter(
            (step): step is ExecutorEstablishRelationStep | ExecutorDissolveRelationStep =>
                step.kind === 'establishRelation' || step.kind === 'dissolveRelation'
        )
        if (relSteps.length === 0) {
            continue
        }
        const mergedSteps: MutationKernelStep[] = [...(outcome.extraKernelSteps ?? []), ...relSteps]

        // LP4c-i: HostRelationalEdgeKind widened (ephemeraMeta.ts) to admit containment ('In'/
        // 'PartOf'), but this ingress-facing route's relationKind stays the narrow set
        // (LD-13/BD-2's kind-narrowing clause, parsePlanStep.ts) --- same drop-the-candidate
        // idiom as the `verdict !== 'legal'` branch above. Applied to the first relational
        // step's relationKind, not `candidate`'s: `candidate` is already narrowly typed
        // (`PeerRelationalEdgeKind`, parsePlanStep.ts) and cannot literally hold a hosting
        // kind, but the executor's own step type (`ExecutorEstablishRelationStep`) carries
        // the wide `HostRelationalEdgeKind` default, and `buildCrossingLegs` mints every step
        // of a chain from the same `kindAndLabel`, so checking the first suffices. Runs before
        // branching on crossing-vs-portless below. Unreachable today: no ingress path can
        // produce a containment candidate (isContainmentSpan routes to nestingDefer before
        // this point). **`On` joined this guard 2026-08-22** (Channel D, CD2, reduced scope):
        // it is a hosting kind too now, deferred at ingress the same way, and equally
        // unreachable here. **`Present` joined 2026-08-22** (presence plan PR-4): it's not a
        // WML-authorable kind either --- an internal port/cover mechanism, never an
        // establishRelation/dissolveRelation target --- so it's deferred at ingress the same way.
        const [firstRelStep] = relSteps
        if (firstRelStep.relationKind === 'In' || firstRelStep.relationKind === 'PartOf' || firstRelStep.relationKind === 'On' || firstRelStep.relationKind === 'Present') {
            continue
        }

        // A genuine crossing always mints exactly one port; the portless/same-host path never
        // does --- cheap, exact discriminator between the two validation paths below.
        const isCrossing = mergedSteps.some((step) => step.kind === 'addCrossingPort')

        if (!isCrossing) {
            // Portless: unchanged legality checking (BD-23: bothObjectsOnGraph + Under cycle
            // detection), against the real current graph. This route once also validated
            // against a *simulated* post-transfer graph, for the repair outcome that moved the
            // subject onto the target's host; PV1-3b-9 (2026-09-01) retired that outcome, so
            // there is no longer a candidate whose legality depends on a move that has not
            // happened yet. Reuses `firstRelStep` (not a fresh destructure) so TS keeps the
            // hosting-kind narrowing the guard above already established on it.
            // LP4g widened the executor's relational step terminals to
            // EphemeraLudicTerminalPrimitive/EphemeraLudicTerminalId (port addresses, for
            // crossing legs); the portless path never produces one, so this guard is
            // defensive, not load-bearing --- `isCrossing` above already routed a
            // port-address candidate to the other branch.
            if (
                typeof firstRelStep.subjectId !== 'string' || typeof firstRelStep.targetId !== 'string'
                || !isEphemeraObjectId(firstRelStep.subjectId) || !isEphemeraObjectId(firstRelStep.targetId)
            ) {
                continue
            }

            const correctedStep: EstablishRelationStep | DissolveRelationStep = {
                kind: firstRelStep.kind,
                subjectId: firstRelStep.subjectId,
                targetId: firstRelStep.targetId,
                // Inlined rather than routed through `relationKindAndLabelFrom`: the guard
                // above narrowed `firstRelStep` to the ingress-lane kinds, and the shared
                // helper's wide return type would discard exactly that narrowing.
                ...(firstRelStep.relationKind === 'Custom'
                    ? { relationKind: 'Custom' as const, relationLabel: firstRelStep.relationLabel }
                    : { relationKind: firstRelStep.relationKind }),
                // PV1-3b-1: sourced from the step's own carried `hostId` (PV1-3b-7) rather than
                // a separate `getCurrentHostForExpansion` re-derivation --- that re-derivation
                // predates PV1-3b-7 and is exactly the "re-derive downstream" pattern PV1-3b-7
                // moved away from; it was also stricter than necessary (dropped a same-host
                // candidate outright whenever the subject had more than one direct container,
                // even when `findShardBoundary` had already resolved a common ancestor fine).
                hostRoomId: firstRelStep.hostId,
            }

            const validationGraph = getGraph(firstRelStep.hostId)
            const legalResult = filterLegalRelationalCandidates([correctedStep], {
                getGraph: (lookupHostId) => (lookupHostId === firstRelStep.hostId ? validationGraph : undefined),
            })
            if (!legalResult.ok || legalResult.candidates.length === 0) {
                continue
            }
        }
        // Crossing: `filterLegalRelationalCandidates` is typed for the narrow ingress shape
        // (EphemeraObjectId endpoints, a single hostRoomId) and cannot accept a port-address
        // endpoint, so it is skipped entirely here --- matching PV1-3b-3's already-decided
        // call that leg-time validation is sufficient on its own. The structural safety net
        // still exists at commit time: `applyRelationalPatch` (`ludicGraph/index.ts`) already
        // throws on `!bothObjectsOnGraph` before any write. **Named gap, not fixed this
        // slice:** `detectRelationalCycle` is not re-run anywhere for a crossing `Under`
        // candidate --- neither `findShardBoundary`/`buildCrossingLegs` nor the commit path
        // call it --- so a cyclic `Under` crossing is not rejected pre-commit today. Not a
        // blocker for `tie` (`Custom`); flagged for a later slice.

        preparedCandidates.push({ candidate, steps: mergedSteps })
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

    // PV1-3b-1: sourced from the original grounded `candidate`, not a step --- always plain
    // Object-to-Object, unlike a crossing's own leg endpoints. Inlined rather than routed
    // through `relationKindAndLabelFrom`: that helper's return type defaults to the wide
    // `HostRelationalEdgeKind`, which would discard `candidate.relationKind`'s own narrow
    // `PeerRelationalEdgeKind` typing --- same reason the portless branch above inlines it.
    return {
        type: 'EstablishRelation',
        operationKind: chosen.candidate.kind,
        subjectId: chosen.candidate.subjectId,
        targetId: chosen.candidate.targetId,
        ...(chosen.candidate.relationKind === 'Custom'
            ? { relationKind: 'Custom' as const, relationLabel: chosen.candidate.relationLabel }
            : { relationKind: chosen.candidate.relationKind }),
        confidence: intentConfidence,
        steps: chosen.steps,
    }
}
