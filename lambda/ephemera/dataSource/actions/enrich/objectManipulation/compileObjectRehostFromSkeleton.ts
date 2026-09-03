import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ParseCommandErrorResult, ParseCommandObjectRehostResult } from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import type { ParseSkeleton } from './parse/parseToken'
import type { Referent } from './plan/ungroundedPrimitive'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { resolvedSpansFromPools } from './resolvedSpansFromPools'
import type { ResolvedSpan } from './synthesize/groundReferent'

export type CompileObjectRehostFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    subject: Referent
    target: Referent
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileObjectRehostFromSkeletonDeps = IdentityStageDeps

export type CompileObjectRehostFromSkeletonResult =
    | ParseCommandObjectRehostResult
    | ParseCommandErrorResult

const resolveSingleObjectId = (
    referent: Referent,
    resolvedSpans: ReadonlyMap<string, ResolvedSpan>
): { type: 'ok'; objectId: EphemeraObjectId } | { type: 'error'; errorMessage: string } => {
    if (referent.referentType !== 'objectSpan' || referent.stableRefKey === undefined) {
        return { type: 'error', errorMessage: objectManipulationErrorMessages.noMatch }
    }
    const resolved = resolvedSpans.get(referent.stableRefKey)
    // 'unresolved' only arises from an empty catalog, which `runIdentityStageOverSkeleton`
    // already turns into a `noCatalog` error before this point --- defensive, not reachable
    // via this route today (same idiom `compileRelationalFromSkeleton.ts` uses elsewhere).
    if (!resolved || resolved.verdict === 'unresolved') {
        return { type: 'error', errorMessage: objectManipulationErrorMessages.noMatch }
    }
    const objectCandidates = resolved.candidateIds.filter(isEphemeraObjectId)
    if (objectCandidates.length === 0) {
        return { type: 'error', errorMessage: objectManipulationErrorMessages.noMatch }
    }
    if (objectCandidates.length > 1) {
        return { type: 'error', errorMessage: objectManipulationErrorMessages.ambiguousMatch }
    }
    return { type: 'ok', objectId: objectCandidates[0] }
}

/**
 * PV1-2 client wiring: `On` is a rehost carrying a containment argument, not a peer
 * relational edge, so it does not go through `compileRelationalFromSkeleton.ts`'s
 * Grounding/Expansion/Validation (those solve peer-relation-specific problems --- candidate
 * combinations, same-host boundary legality --- that don't apply to a rehost). This resolves
 * `subject`/`target` to object ids with the same Identify step
 * (`runIdentityStageOverSkeleton`) that route already runs, then stops: it does not resolve
 * `subjectId`'s *current* host --- that's read fresh by the positions-layer consumer
 * (`getMembershipContainers`) at execution time rather than baked in here, since parse and
 * execution are not the same moment (the object could move between them).
 *
 * Scope cuts, deliberate: multi-candidate (ambiguous) resolution errors out rather than
 * disambiguating; `In`/`PartOf` never reach this function (parseCommand.ts still hard-errors
 * them before this point) --- PV-1 builds one hosting kind.
 */
export async function compileObjectRehostFromSkeleton(
    input: CompileObjectRehostFromSkeletonInput,
    intentConfidence: number,
    deps: CompileObjectRehostFromSkeletonDeps = {}
): Promise<CompileObjectRehostFromSkeletonResult> {
    if (input.hostRoomId === undefined) {
        return { type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom }
    }
    const hostRoomId = input.hostRoomId

    const catalog = mergeObjectManipulationCatalogs(
        input.roomObjectCatalog ?? [],
        input.heldInventoryCatalog ?? []
    )

    const identityResult = await runIdentityStageOverSkeleton(input.command, input.skeleton, catalog, deps)
    if (identityResult.type === 'error') {
        return { type: 'Error', errorMessage: identityResult.errorMessage }
    }
    const resolvedSpans = resolvedSpansFromPools(identityResult.spanPools)

    const subjectResolved = resolveSingleObjectId(input.subject, resolvedSpans)
    if (subjectResolved.type === 'error') {
        return { type: 'Error', errorMessage: subjectResolved.errorMessage }
    }
    const targetResolved = resolveSingleObjectId(input.target, resolvedSpans)
    if (targetResolved.type === 'error') {
        return { type: 'Error', errorMessage: targetResolved.errorMessage }
    }

    return {
        type: 'ObjectRehost',
        subjectId: subjectResolved.objectId,
        targetId: targetResolved.objectId,
        hostId: hostRoomId,
        containment: 'On',
        confidence: intentConfidence,
    }
}
