import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandErrorResult,
    ParseCommandLookComponentResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import { objectCandidatesForSpan } from './objectCandidatesForSpan'
import type { ParseSkeleton } from './parse/parseToken'
import { matchLookTemplate } from './plan/matchLookTemplate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type CompileDescribeFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    characterId?: EphemeraCharacterId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileDescribeFromSkeletonDeps = IdentityStageDeps

export type CompileDescribeFromSkeletonResult =
    | ParseCommandLookComponentResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

/**
 * Object-directed look's Plan pipeline (iteration 9, Phase 4): Plan match
 * (matchLookTemplate) -> Identify (runIdentityStageOverSkeleton) -> a direct pool read
 * (`objectCandidatesForSpan`, singular). No Expansion/Validation leg --- unlike relational,
 * a describe referent is singular with no relation to another referent, so
 * there is no `sameHost` placement or cycle-legality check to run, and no general Synthesize executor seed is built. Only ever produces
 * candidates the catalog scan can populate today (Object only --- catalog
 * population for Character/Feature is iteration 10 on the object-manipulation
 * ladder; see `dataSource/actions/AGENT.implementation.md`),
 * so filtering to EphemeraObjectId candidates is today a no-op guard, not a
 * scope restriction that silently drops real Character/Feature matches.
 */
export async function compileDescribeFromSkeleton(
    input: CompileDescribeFromSkeletonInput,
    intentConfidence: number,
    deps: CompileDescribeFromSkeletonDeps = {}
): Promise<CompileDescribeFromSkeletonResult> {
    const match = matchLookTemplate(input.skeleton)
    if (match.type === 'noMatch') {
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

    if (match.referent.referentType !== 'objectSpan' || match.referent.stableRefKey === undefined) {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: `${match.referent.referentType} referent has no stableRefKey to resolve against`,
        }
    }

    const objectCandidate = objectCandidatesForSpan(identityResult.spanPools, match.referent.stableRefKey)[0]
    if (objectCandidate === undefined) {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: 'No object candidate in the pool resolved to a describable referent',
        }
    }

    return {
        type: 'LookComponent',
        componentId: objectCandidate,
        confidence: intentConfidence,
    }
}
