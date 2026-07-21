import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import type {
    ParseCommandAbstainResult,
    ParseCommandErrorResult,
    ParseCommandEstablishRelationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { EphemeraPositionGraph } from '../../../positions/positionGraph'

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
import { expandSameHost } from './synthesize/expandSameHost'
import { filterLegalRelationalCandidates } from './synthesize/filterLegalRelationalCandidates'
import { groundChange } from './synthesize/groundChange'
import type { GroundingContext } from './synthesize/groundReferent'

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
    getPositionGraph: (hostId) => internalCache.Positions.getPositionGraph(hostId),
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
 * currentHost(actingCharacter) (BD-6's default) --- BD-16's rebuilt Expansion
 * pass (2026-07-21) corrects this per-candidate against the subject/object's
 * real current hosts: `satisfied` confirms/redirects the host to wherever they
 * actually already share one (Room or Character), `repaired` inserts a
 * transferMembership the compound apply (`applyObjectRelationalChangeWithTransfer.ts`)
 * commits atomically with the relation. `defer` (Custom-relation violations)
 * has no Consult/LLM-fallback path on this route yet (unlike membership) and
 * is dropped, same as any other decline.
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
    const roomGraph = await positionsReadDeps.getPositionGraph(hostRoomId)
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

    const hostGraphMap = new Map<EphemeraMembershipHostId, EphemeraPositionGraph>([[hostRoomId, roomGraph]])
    for (const hostId of hostByObjectId.values()) {
        if (!hostGraphMap.has(hostId)) {
            hostGraphMap.set(hostId, await positionsReadDeps.getPositionGraph(hostId))
        }
    }
    const getGraph = (hostId: EphemeraMembershipHostId): EphemeraPositionGraph | undefined => hostGraphMap.get(hostId)

    type PreparedCandidate = {
        step: EstablishRelationStep | DissolveRelationStep
        transferFromHostId?: EphemeraMembershipHostId
    }

    const preparedCandidates: PreparedCandidate[] = []
    for (const candidate of relationalCandidates) {
        const sameHostResult = expandSameHost(
            { subjectId: candidate.subjectId, objectId: candidate.targetId, relationKind: candidate.relationKind, negate: false },
            getCurrentHostForExpansion,
            getGraph
        )
        // `defer`/`error`: this route has no Consult/LLM-fallback path today (unlike
        // membership) --- drop the candidate, same as any other Grounding/Validation
        // decline. `defer` is the known gap iteration 2's plan-only/joint fallback
        // work is meant to eventually close.
        if (sameHostResult.verdict === 'defer' || sameHostResult.verdict === 'error') {
            continue
        }

        const correctedStep: EstablishRelationStep | DissolveRelationStep = {
            ...candidate,
            hostRoomId: sameHostResult.hostId,
        }

        // Validate legality against the state the command would actually produce: the
        // real current graph when satisfied, or a simulated post-transfer graph when
        // repaired (the subject isn't actually on the destination host yet at compile
        // time --- the real transfer only happens inside the compound apply's own
        // commit-time re-verification).
        const validationGraph = sameHostResult.verdict === 'repaired'
            ? getGraph(sameHostResult.hostId)?.addObject(candidate.subjectId)
            : getGraph(sameHostResult.hostId)

        const legalResult = filterLegalRelationalCandidates([correctedStep], {
            getGraph: (hostId) => (hostId === sameHostResult.hostId ? validationGraph : undefined),
        })
        if (!legalResult.ok || legalResult.candidates.length === 0) {
            continue
        }

        preparedCandidates.push({
            step: correctedStep,
            ...(sameHostResult.verdict === 'repaired'
                ? { transferFromHostId: sameHostResult.transferStep.fromHostId }
                : {}),
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
        relationKind: chosen.step.relationKind,
        ...(chosen.step.relationLabel !== undefined ? { relationLabel: chosen.step.relationLabel } : {}),
        hostId: chosen.step.hostRoomId,
        confidence: intentConfidence,
        ...(chosen.transferFromHostId !== undefined ? { transferFromHostId: chosen.transferFromHostId } : {}),
    }
}
