import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ParseCommandErrorResult, ParseCommandObjectContainmentResult } from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import { objectCandidatesForSpan } from './objectCandidatesForSpan'
import type { ParseSkeleton } from './parse/parseToken'
import type { Referent } from './plan/planStep'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SpanCandidatePool } from './spanResolution'
import { buildCommandAttemptReferent } from '../../commandAttempt/referent'
import { PositionAttemptAction } from '../../commandAttempt/action'
import type { CommandAttemptData } from '../../commandAttempt'

export type CompileObjectContainmentFromSkeletonInput = {
    command: string
    skeleton: ParseSkeleton
    subject: Referent
    target: Referent
    containment: 'On' | 'In'
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type CompileObjectContainmentFromSkeletonDeps = IdentityStageDeps

export type CompileObjectContainmentFromSkeletonResult =
    | ParseCommandObjectContainmentResult
    | ParseCommandErrorResult

const resolveSingleObjectId = (
    referent: Referent,
    spanPools: ReadonlyMap<string, SpanCandidatePool>
): { type: 'ok'; objectId: EphemeraObjectId } | { type: 'error'; errorMessage: string } => {
    if (referent.referentType !== 'objectSpan' || referent.stableRefKey === undefined) {
        return { type: 'error', errorMessage: objectManipulationErrorMessages.noMatch }
    }
    const objectCandidates = objectCandidatesForSpan(spanPools, referent.stableRefKey)
    if (objectCandidates.length === 0) {
        return { type: 'error', errorMessage: objectManipulationErrorMessages.noMatch }
    }
    if (objectCandidates.length > 1) {
        return { type: 'error', errorMessage: objectManipulationErrorMessages.ambiguousMatch }
    }
    return { type: 'ok', objectId: objectCandidates[0] }
}

/**
 * Trivial attempt-building for containment (slice 2). This route deliberately never
 * resolves the subject's current host at parse time (see
 * `compileObjectContainmentFromSkeleton`'s own doc comment below), so no graph is in hand to
 * classify boundary edges --- unlike the
 * membership route, this isn't a gap, it's an honest "not detected on the fast path."
 * No `PlanStep` shape exists yet for a containment move's containment argument (`Change`
 * only has `transferMembership`/`establishRelation`/`dissolveRelation`), so
 * `desiredResult` stays undefined and the prose gloss alone carries the intent ---
 * `PositionAttemptAction`'s structural half is optional for exactly this reason.
 */
const buildContainmentAttempt = (
    command: string,
    subjectId: EphemeraObjectId,
    targetId: EphemeraObjectId,
    containment: 'On' | 'In' | 'PartOf',
    catalog: readonly ObjectManipulationCatalogEntry[]
): CommandAttemptData => {
    const entryFor = (objectId: EphemeraObjectId) => catalog.find((entry) => entry.objectId === objectId)
    const subjectEntry = entryFor(subjectId)
    const targetEntry = entryFor(targetId)
    const subjectRefKey = `${subjectId}/subject`
    const targetRefKey = `${targetId}/target`
    const preposition = containment === 'On' ? 'on' : 'in'
    const action = new PositionAttemptAction(
        [],
        undefined,
        `Put ${subjectEntry?.normalizedShortName ?? subjectId} ${preposition} ${targetEntry?.normalizedShortName ?? targetId}`
    )

    return {
        words: command,
        referents: [
            buildCommandAttemptReferent(subjectRefKey, subjectId, subjectEntry?.normalizedShortName ?? subjectId, subjectEntry?.gloss),
            buildCommandAttemptReferent(targetRefKey, targetId, targetEntry?.normalizedShortName ?? targetId, targetEntry?.gloss),
        ],
        actions: [action.toJSON()],
    }
}

/**
 * Client wiring: `On` is a containment move carrying a containment argument, not a peer
 * relational edge, so it does not go through `compileRelationalFromSkeleton.ts`'s
 * Grounding/Expansion/Validation (those solve peer-relation-specific problems --- candidate
 * combinations, same-host boundary legality --- that don't apply to a containment move). This
 * resolves `subject`/`target` to object ids with the same Identify step
 * (`runIdentityStageOverSkeleton`) that route already runs, then stops: it does not resolve
 * `subjectId`'s *current* host --- that's read fresh by the positions-layer consumer
 * (`getMembershipContainers`) at execution time rather than baked in here, since parse and
 * execution are not the same moment (the object could move between them).
 *
 * Scope cuts, deliberate: multi-candidate (ambiguous) resolution errors out rather than
 * disambiguating; `PartOf` never reaches this function (parseCommand.ts still hard-errors
 * it before this point, per ND-4 in AGENT.nestedObjectLook.planning.md) --- `containment`
 * is `input.containment`, forwarded from the caller's matched relational-defer kind, not
 * hardcoded.
 */
export async function compileObjectContainmentFromSkeleton(
    input: CompileObjectContainmentFromSkeletonInput,
    intentConfidence: number,
    deps: CompileObjectContainmentFromSkeletonDeps = {}
): Promise<CompileObjectContainmentFromSkeletonResult> {
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
    const subjectResolved = resolveSingleObjectId(input.subject, identityResult.spanPools)
    if (subjectResolved.type === 'error') {
        return { type: 'Error', errorMessage: subjectResolved.errorMessage }
    }
    const targetResolved = resolveSingleObjectId(input.target, identityResult.spanPools)
    if (targetResolved.type === 'error') {
        return { type: 'Error', errorMessage: targetResolved.errorMessage }
    }

    return {
        type: 'ObjectContainment',
        subjectId: subjectResolved.objectId,
        targetId: targetResolved.objectId,
        hostId: hostRoomId,
        containment: input.containment,
        confidence: intentConfidence,
        attempt: buildContainmentAttempt(input.command, subjectResolved.objectId, targetResolved.objectId, input.containment, catalog),
    }
}
