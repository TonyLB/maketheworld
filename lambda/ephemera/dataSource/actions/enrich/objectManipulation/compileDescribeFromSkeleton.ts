import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandLookComponentResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { enumerateIdentityAssignments } from './enumerateIdentityAssignments'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import type { ParseSkeleton } from './parse/parseToken'
import type { Referent } from './plan/planStep'
import { stampReferent } from './stampCandidateReferents'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import type { ConsultAlternative, ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'
import { NarrateAttemptAction } from '../../commandAttempt/action'
import { CommandAttempt } from '../../commandAttempt'

export type CompileDescribeFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    /** Plan's ungrounded attempt: its narration action names the referent (ISS8203 slice 1). */
    attempt: CommandAttempt
    characterId?: EphemeraCharacterId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileDescribeFromSkeletonDeps = IdentityStageDeps

export type CompileDescribeFromSkeletonResult =
    | ParseCommandLookComponentResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

/**
 * One producer candidate (the shared selection stage's input), mirroring
 * `ContainmentGroundedCandidate` (`compileObjectContainmentFromSkeleton.ts`) reduced to one
 * referent: no self-relation guard applies, since there's nothing to compare a single
 * referent against.
 */
type DescribeGroundedCandidate = {
    candidateId: EphemeraObjectId
    confidence: number
    attempt: CommandAttempt
    label: string
}

type ProposeDescribeCandidatesResult =
    | { ok: true; candidates: DescribeGroundedCandidate[] }
    | { ok: false; reason: string }

/**
 * The describe route's producer, modeled directly on
 * `proposeContainmentCandidates` reduced from two referents to one: one identity pool,
 * enumerated into assignments (`enumerateIdentityAssignments`, whose confidence for
 * one key is just that key's own `jointRelevance`), each building a `CommandAttempt` whose
 * one action is a `NarrateAttemptAction` --- describing a referent is not a world mutation,
 * so there is no `PlanStep`/`desiredResult` for it, only prose.
 */
const proposeDescribeCandidates = (
    command: string,
    spanRef: Referent,
    stableRefKey: string,
    spanPools: ReadonlyMap<string, SpanCandidatePool>,
    catalog: readonly ObjectManipulationCatalogEntry[]
): ProposeDescribeCandidatesResult => {
    const pool = spanPools.get(stableRefKey)
    if (!pool) {
        return { ok: false, reason: `No resolution supplied for stableRefKey "${stableRefKey}"` }
    }
    const candidates: readonly ObjectSpanCandidate[] = (pool.shortlist ?? pool.candidates)
        .filter((candidate) => isEphemeraObjectId(candidate.id))
    if (candidates.length === 0) {
        return { ok: false, reason: `No candidates found for span "${pool.span}"` }
    }

    const assignments = enumerateIdentityAssignments(new Map([[stableRefKey, candidates]]))
    if (assignments.length === 0) {
        return { ok: false, reason: 'No object candidate in the pool resolved to a describable referent' }
    }

    const describeCandidates = assignments.map(({ identities, confidence }) => {
        const candidateId = identities.get(stableRefKey)!.objectId
        const entry = catalog.find((entry) => entry.objectId === candidateId)
        const label = entry?.normalizedShortName ?? candidateId

        const referent = stampReferent(
            spanRef,
            new Map([[stableRefKey, { id: candidateId, shortName: label, gloss: entry?.gloss }]])
        )
        const action = new NarrateAttemptAction([], `Look at the ${label}`, [referent])
        const attempt = CommandAttempt.create(command, [action])

        return { candidateId, confidence, attempt, label }
    })
    return { ok: true, candidates: describeCandidates }
}

/** Consult wording for describe: one line naming the single referent. */
const describeConsultAlternative = (candidate: DescribeGroundedCandidate): ConsultAlternative => ({
    objectId: candidate.candidateId,
    label: candidate.label,
    proposedCommand: `look at the ${candidate.label}`,
})

/**
 * Object-directed look's Plan pipeline (iteration 9, Phase 4; since split into producer and shared stage):
 * Plan match (matchLookTemplate) -> Identify (runIdentityStageOverSkeleton) -> the describe
 * producer (`proposeDescribeCandidates`) -> `selectPlanTuple`. No Expansion/
 * Validation leg --- unlike relational, a describe referent is singular with no relation to
 * another referent, so there is no `sameHost` placement or cycle-legality check to run, and
 * no general Synthesize executor seed is built; every candidate is trivially legal, so the
 * dry run is a constant `legal`, and `selectPlanTuple` runs the same floor/margin/Consult
 * machinery every route uses. Only ever produces candidates the catalog scan can populate
 * today (Object only --- catalog population for Character/Feature is iteration 10 on the
 * object-manipulation ladder; see `dataSource/actions/AGENT.implementation.md`), so filtering
 * to EphemeraObjectId candidates is today a no-op guard, not a scope restriction that
 * silently drops real Character/Feature matches.
 */
export async function compileDescribeFromSkeleton(
    input: CompileDescribeFromSkeletonInput,
    intentConfidence: number,
    deps: CompileDescribeFromSkeletonDeps = {}
): Promise<CompileDescribeFromSkeletonResult> {
    const [spanRef] = input.attempt.actions()[0]?.referents() ?? []
    if (spanRef === undefined) {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: objectManipulationErrorMessages.lookNoTemplateMatch,
        }
    }

    if (input.characterId === undefined) {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noActingCharacter,
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

    if (spanRef.referentType !== 'objectSpan' || spanRef.stableRefKey === undefined) {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: `${spanRef.referentType} referent has no stableRefKey to resolve against`,
        }
    }

    const proposed = proposeDescribeCandidates(input.command, spanRef, spanRef.stableRefKey, identityResult.spanPools, catalog)
    if (!proposed.ok) {
        return { type: 'Abstain', confidence: intentConfidence, reason: proposed.reason }
    }

    const selection = selectPlanTuple({
        candidates: proposed.candidates,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: () => ({ verdict: 'legal', decidable: true }),
        toConsultAlternative: describeConsultAlternative,
    })

    if (selection.verdict === 'consult') {
        return {
            type: 'Consult',
            alternatives: selection.alternatives.map(({ proposedCommand, objectId }) => ({ proposedCommand, objectId })),
            confidence: intentConfidence,
        }
    }

    if (selection.verdict === 'abstain' || selection.verdict === 'error') {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.reason,
        }
    }

    if (selection.verdict === 'defer') {
        // Cannot occur: the dry run above always reports `legal`, never `defer`.
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.dryRun.reason ?? objectManipulationErrorMessages.noMatch,
        }
    }

    const { candidate } = selection

    return {
        type: 'LookComponent',
        componentId: candidate.candidateId,
        confidence: intentConfidence,
        attempt: candidate.attempt.toJSON(),
    }
}
