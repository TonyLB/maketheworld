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
 * already share one); `repaired` mints a real `transferMembership` (+ any
 * boundary `dissolveRelation`s, BD-28) ahead of the relational step in the
 * executor's output-ordered list. `defer` (Custom-relation violations) has no
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

    // BD-16 sameHost repair (2026-07-21): groundChange still derives every candidate's
    // host as currentHost(actingCharacter) (BD-6's default, unchanged) --- expandSameHost
    // is the Expansion pass that corrects this per-candidate against the subject/object's
    // real current hosts, either confirming that default (satisfied) or inserting a
    // transferMembership repair (repaired) when they don't already share a host.
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
        transferFromHostId?: EphemeraMembershipHostId
    }

    const preparedCandidates: PreparedCandidate[] = []
    for (const candidate of relationalCandidates) {
        const sameHostAssertion: GroundedBinaryAssertion = {
            kind: 'assertion',
            predicate: 'sameHost',
            subjectId: candidate.subjectId,
            objectId: candidate.targetId,
            negate: false,
            relationKind: candidate.relationKind,
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
        const env = createExpansionEnvironment(getGraph, getCurrentHostForExpansion)
        const outcome = runExecutor(seed, env, context)

        // `defer`/`error`: this route has no Consult/LLM-fallback path today (unlike
        // membership) --- drop the candidate, same as any other Grounding/Validation
        // decline. `defer` is the known gap iteration 2's plan-only/joint fallback
        // work is meant to eventually close.
        if (outcome.verdict !== 'legal') {
            continue
        }

        const transferStep = outcome.steps.find(
            (step): step is Extract<typeof step, { kind: 'transferMembership' }> => step.kind === 'transferMembership'
        )
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
        if (!isEphemeraObjectId(relStep.subjectId) || !isEphemeraObjectId(relStep.targetId)) {
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

        const hostId = transferStep !== undefined ? transferStep.toHostId : getCurrentHostForExpansion(candidate.subjectId)
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
        // against the state the command would actually produce: the real current graph
        // when satisfied, or a simulated post-transfer graph when repaired (the subject
        // isn't actually on the destination host yet at compile time --- the real
        // transfer only happens inside the general kernel's own commit-time
        // re-verification). This narrow simulation is orthogonal to what the executor
        // computes (Grounding/Expansion/host-derivation) --- cycle detection needs a
        // real graph object to simulate the patch against, which the executor's pure
        // step list does not carry.
        const validationGraph = transferStep !== undefined
            ? getGraph(hostId)?.addObject(candidate.subjectId)
            : getGraph(hostId)

        const legalResult = filterLegalRelationalCandidates([correctedStep], {
            getGraph: (lookupHostId) => (lookupHostId === hostId ? validationGraph : undefined),
        })
        if (!legalResult.ok || legalResult.candidates.length === 0) {
            continue
        }

        preparedCandidates.push({
            step: correctedStep,
            ...(transferStep !== undefined ? { transferFromHostId: transferStep.fromHostId } : {}),
        })
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
        ...(chosen.transferFromHostId !== undefined ? { transferFromHostId: chosen.transferFromHostId } : {}),
    }
}
