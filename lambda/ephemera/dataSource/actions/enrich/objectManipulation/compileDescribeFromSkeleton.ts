import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandLookComponentResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { CommandAttempt } from '../../commandAttempt'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverReferenceKeys } from './identifySkeletonSpans'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import { attemptDryRun, attemptSpanKeys, groundedObjectIdOf, proposeAttemptCandidates } from './attemptCandidates'

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
 * Object-directed look's Plan pipeline (iteration 9, Phase 4; since split into producer and shared
 * stage): Plan's attempt -> Identify (runIdentityStageOverReferenceKeys) -> the shared producer
 * (`attemptCandidates.ts`) -> selection. A look is a step-less narration, so the shared dry run is
 * a constant `legal` and there is no environment to build. Every candidate is trivially legal, and
 * selection runs the same floor/margin/Consult machinery every route uses.
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

    const identityResult = await runIdentityStageOverReferenceKeys(
        input.command,
        input.skeleton,
        attemptSpanKeys([input.attempt]),
        catalog,
        deps
    )
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

    const proposed = proposeAttemptCandidates({
        command: input.command,
        attempts: [input.attempt],
        spanPools: identityResult.spanPools,
        catalog,
        noAssignmentReason: 'No object candidate in the pool resolved to a describable referent',
    })
    if (!proposed.ok) {
        return { type: 'Abstain', confidence: intentConfidence, reason: proposed.reason }
    }

    // A look has no steps, so the shared dry run never reads its environment.
    const selection = selectPlanTuple({
        candidates: proposed.candidates,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: (candidate) => attemptDryRun(candidate, undefined),
        toConsultAlternative: (candidate) => candidate.alternative,
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
        // Cannot occur: the dry run above always reports `legal` for a look, never `defer`.
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.dryRun.reason ?? objectManipulationErrorMessages.noMatch,
        }
    }

    const { candidate } = selection
    const [groundedSpan] = candidate.attempt.actions()[0]!.referents()

    return {
        type: 'LookComponent',
        componentId: groundedObjectIdOf(groundedSpan!),
        confidence: intentConfidence,
        attempt: candidate.attempt.toJSON(),
    }
}
