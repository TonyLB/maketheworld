import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

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
import { groundChange } from './synthesize/groundChange'
import type { GroundingContext } from './synthesize/groundReferent'
import { createExpansionEnvironment } from './synthesize/expansionEnvironment'
import { runExecutor } from './synthesize/executor'
import type { GroundedBinaryAssertion, WorklistInstruction } from './synthesize/executorTypes'

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
 * this seeds the general Synthesize executor with a grounded `[sameHost,
 * relationalChange]` pair (mirroring `[sameHostAssertion, change]`'s standard
 * seed order) and runs it, exactly the same executor `executeObjectEstablishRelation`/
 * `executeObjectDissolveRelation`'s commit path re-runs later --- `satisfied`
 * retires the assertion with no children (host is wherever subject/object
 * already share one). A violated assertion once minted a `transferMembership`
 * repair here; PV1-3b-9 (2026-09-01) retired that, so a violation now either
 * becomes crossing legs or declines. `defer` (peer-relation violations) has no
 * Consult/LLM-fallback path on this route yet (unlike membership) and is
 * dropped, same as any other decline. `expandSameHost.ts` itself is not
 * called directly here anymore --- the executor's own `sameHost`
 * command-expansion calls it internally.
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
    // PV1-3b-9 (2026-09-01) retired that, so it now either confirms the default
    // (satisfied), expresses the mismatch as crossing legs, or declines.
    const distinctObjectIds = new Set<EphemeraObjectId>()
    for (const candidate of relationalCandidates) {
        distinctObjectIds.add(candidate.subjectId)
        distinctObjectIds.add(candidate.targetId)
    }

    const hostByObjectId = new Map<EphemeraObjectId, EphemeraMembershipHostId>()
    for (const objectId of distinctObjectIds) {
        const containers = await positionsReadDeps.getMembershipContainers(objectId)
        if (containers.length === 1) {
            hostByObjectId.set(objectId, containers[0])
        }
    }
    const getCurrentHostForExpansion = (objectId: EphemeraObjectId): EphemeraMembershipHostId | undefined =>
        hostByObjectId.get(objectId)

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
        const sameHostAssertion: GroundedBinaryAssertion = {
            kind: 'assertion',
            predicate: 'sameHost',
            subjectId: candidate.subjectId,
            objectId: candidate.targetId,
            // PV1-3b-6: carry the label, not just the kind --- `expandSameHost`'s crossing gate
            // requires it for `Custom`, and this seed used to drop it, so no live `Custom`
            // relation could reach the crossing path at all. Spread as a unit (the same helper
            // the sibling literal below uses) so the `Custom`/enum branch is stated once.
            ...relationKindAndLabelFrom(candidate),
        }
        const relationalStepNoHost = {
            kind: candidate.kind,
            subjectId: candidate.subjectId,
            targetId: candidate.targetId,
            ...relationKindAndLabelFrom(candidate),
        } as EstablishRelationStep | DissolveRelationStep
        const seed: WorklistInstruction[] = [
            { id: `${candidate.subjectId}/sameHost`, tag: 'grounded', step: sameHostAssertion },
            { id: `${candidate.subjectId}/relationalChange`, tag: 'grounded', step: relationalStepNoHost },
        ]
        // PV1-3: `expandSameHost` can now resolve a violated Custom relation into a genuine
        // shard-boundary crossing (BD-16's third outcome) instead of always deferring --- but two
        // gaps keep that path unreachable from here today, deliberately, rather than half-wired.
        // (A third --- this seed dropping `relationLabel`, which the crossing gate requires for
        // `Custom` --- was closed by PV1-3b-6, 2026-09-01; the label is threaded above now.)
        // (1) `getMembershipContainers`/`getCurrentHostForExpansion` above only pre-fetch one hop
        // per distinct object id, while `findShardBoundary`'s walk needs to keep going past
        // intermediate hosts too --- and `createExpansionEnvironment` below is not even handed a
        // container lookup yet, so the walk finds nothing at all from here (PV1-3b-5);
        // (2) even with deeper pre-fetching, this seed's sibling
        // `relationalStepNoHost` item would still retire unmodified alongside the crossing legs,
        // producing an extra (invalid, endpoints-don't-share-a-host) direct edge --- the
        // satisfied outcome relies on that sibling retiring as-is, but a crossing replaces
        // it entirely and needs the seed built accordingly (PV1-3b-4's seed collapse, still open).
        // Wiring this live route is future work;
        // `expandSameHost`/`commandExpand`/`buildCrossingLegs` are unit-tested directly instead
        // (`expandSameHost.test.ts`, `executor.test.ts`, `buildCrossingLegs.test.ts`).
        const env = createExpansionEnvironment(getGraph, getCurrentHostForExpansion)
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
