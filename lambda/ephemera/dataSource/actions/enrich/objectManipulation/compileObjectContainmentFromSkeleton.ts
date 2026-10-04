import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandObjectContainmentResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { enumerateIdentityAssignments } from './enumerateIdentityAssignments'
import type { IdentityStageDeps } from './identityStage'
import { runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import type { ParseSkeleton } from './parse/parseToken'
import { currentHostRef, type Referent } from './plan/planStep'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { selectPlanTuple } from './selectPlanCandidate'
import type { ConsultAlternative, ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'
import { buildCommandAttemptReferent } from '../../commandAttempt/referent'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { CommandAttempt } from '../../commandAttempt'

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
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

/**
 * One producer candidate (AP-1's stage sketch, slice 3c), mirroring
 * `RelationalGroundedCandidate` (`compileRelationalFromSkeleton.ts`): a joint identity
 * assignment over subject/target, the attempt built from it, and enough to render Consult
 * wording --- before selection.
 */
type ContainmentGroundedCandidate = {
    candidateId: { subjectId: EphemeraObjectId; targetId: EphemeraObjectId }
    confidence: number
    attempt: CommandAttempt
    subjectLabel: string
    targetLabel: string
}

type ProposeContainmentCandidatesResult =
    | { ok: true; candidates: ContainmentGroundedCandidate[] }
    | { ok: false; reason: string }

type KeyedPool = { ok: true; key: string; candidates: readonly ObjectSpanCandidate[] } | { ok: false; reason: string }

const keyedPool = (
    referent: Referent,
    spanPools: ReadonlyMap<string, SpanCandidatePool>
): KeyedPool => {
    if (referent.referentType !== 'objectSpan' || referent.stableRefKey === undefined) {
        const span = referent.referentType === 'objectSpan' ? referent.span : referent.referentType
        return { ok: false, reason: `objectSpan referent for span "${span}" has no stableRefKey to ground against` }
    }
    const key = referent.stableRefKey
    const pool = spanPools.get(key)
    if (!pool) {
        return { ok: false, reason: `No resolution supplied for stableRefKey "${key}"` }
    }
    const candidates = pool.shortlist ?? pool.candidates
    if (candidates.length === 0) {
        return { ok: false, reason: `No candidates found for span "${pool.span}"` }
    }
    // identityFromSpanCandidate (via enumerateIdentityAssignments) throws on a non-Object id.
    return { ok: true, key, candidates: candidates.filter((candidate) => isEphemeraObjectId(candidate.id)) }
}

/**
 * The containment route's producer (AP-1/AP-4, slice 3c), modeled directly on
 * `proposeRelationalCandidates`: one identity pool per referent, enumerated into joint
 * assignments (`enumerateIdentityAssignments`, AP-2's `min` confidence), with AP-12's
 * self-relation rule reused ("put cup on cup" is never a candidate). Unlike relational,
 * grounding is deliberately deferred here, not done eagerly: the step's `from` is a derived
 * referent (`currentHost(subject)`) with no live snapshot to resolve it against yet, and
 * AP-10's resolution to the partial-grounding fork is to defer *all* grounding of a step to
 * one place --- the dry run or, for containment, `commitAttempt`'s own generic resolution
 * against live state. So the attempt's `desiredResult` stays ungrounded here, carrying real
 * `stableRefKey`s on `object`/`to` so it can ground later purely from the attempt's own
 * referents (`buildCommandAttemptReferent` below uses the same keys).
 */
const proposeContainmentCandidates = (
    input: CompileObjectContainmentFromSkeletonInput,
    spanPools: ReadonlyMap<string, SpanCandidatePool>,
    catalog: readonly ObjectManipulationCatalogEntry[]
): ProposeContainmentCandidatesResult => {
    const subjectPool = keyedPool(input.subject, spanPools)
    if (!subjectPool.ok) {
        return { ok: false, reason: subjectPool.reason }
    }
    const targetPool = keyedPool(input.target, spanPools)
    if (!targetPool.ok) {
        return { ok: false, reason: targetPool.reason }
    }

    const subjectKey = subjectPool.key
    const targetKey = targetPool.key
    // A containment move joins two different things (AP-12, reused): an assignment that
    // grounds subject and target to the same object is never a candidate.
    const assignments = enumerateIdentityAssignments(new Map([
        [subjectKey, subjectPool.candidates],
        [targetKey, targetPool.candidates],
    ])).filter(({ identities }) => identities.get(subjectKey)?.objectId !== identities.get(targetKey)?.objectId)
    if (assignments.length === 0) {
        return { ok: false, reason: 'No combination of two distinct grounded objects produced a well-typed containment move' }
    }

    const candidates = assignments.map(({ identities, confidence }) => {
        const subjectId = identities.get(subjectKey)!.objectId
        const targetId = identities.get(targetKey)!.objectId

        const subjectEntry = catalog.find((entry) => entry.objectId === subjectId)
        const targetEntry = catalog.find((entry) => entry.objectId === targetId)
        const subjectName = subjectEntry?.normalizedShortName ?? subjectId
        const targetName = targetEntry?.normalizedShortName ?? targetId

        // `input.subject`/`input.target` are already validated `objectSpan` referents
        // carrying `subjectKey`/`targetKey` (`keyedPool`'s guard above), so they're reused
        // directly rather than reconstructed --- same referent the attempt's `stableRefKey`
        // ties the prose to.
        const desiredResult = {
            kind: 'change' as const,
            primitive: 'transferMembership' as const,
            object: input.subject,
            from: currentHostRef(input.subject),
            to: input.target,
            containment: input.containment,
        }

        const preposition = input.containment === 'On' ? 'on' : 'in'
        const action = new PositionAttemptAction(
            [],
            desiredResult,
            `Put ${subjectName} ${preposition} ${targetName}`
        )
        const attempt = CommandAttempt.create(
            input.command,
            [
                buildCommandAttemptReferent(subjectKey, subjectId, subjectName, subjectEntry?.gloss),
                buildCommandAttemptReferent(targetKey, targetId, targetName, targetEntry?.gloss),
            ],
            [action]
        )

        return { candidateId: { subjectId, targetId }, confidence, attempt, subjectLabel: subjectName, targetLabel: targetName }
    })
    return { ok: true, candidates }
}

/**
 * AP-3's Consult wording for containment: one line naming both referents, mirroring
 * `relationalConsultAlternative`'s shape. No `objectId` --- a containment alternative names
 * two referents, not one.
 */
const containmentConsultAlternative = (
    candidate: ContainmentGroundedCandidate,
    containment: 'On' | 'In'
): ConsultAlternative => {
    const { subjectLabel, targetLabel } = candidate
    const preposition = containment === 'On' ? 'on' : 'in'
    return { label: `${subjectLabel} / ${targetLabel}`, proposedCommand: `put the ${subjectLabel} ${preposition} the ${targetLabel}` }
}

/**
 * Client wiring: `On`/`In` is a containment move carrying a containment argument, not a peer
 * relational edge, so it does not go through `compileRelationalFromSkeleton.ts`'s
 * Grounding/Expansion/Validation --- those solve peer-relation-specific problems (candidate
 * combinations aside, same-host boundary legality) that don't apply to a containment move.
 * `PartOf` never reaches this function (parseCommand.ts still hard-errors it before this
 * point, per ND-4 in AGENT.nestedObjectLook.planning.md).
 *
 * Slice 3c: the route now produces a real candidate pool (AP-4), replacing the former
 * hard-error-on-ambiguity (`resolveSingleObjectId`'s `ambiguousMatch`). It deliberately still
 * never resolves the subject's *current* host at parse time --- that's read fresh by the
 * positions-layer consumer (`getMembershipContainers`, via `commitAttempt`'s generic derived-
 * referent resolution) at execution time rather than baked in here, since parse and execution
 * are not the same moment (the object could move between them). There is no construction-time
 * legality check beyond the self-containment guard above (AP-11/AP-12's precedent): cycle
 * detection (`hasPresenceAncestor`) and "already there" stay at commit, as today.
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

    const proposed = proposeContainmentCandidates(input, identityResult.spanPools, catalog)
    if (!proposed.ok) {
        return { type: 'Abstain', confidence: intentConfidence, reason: proposed.reason }
    }

    // No shard-crossing concern for the established edge (its host is always `target`, by
    // construction --- see this file's own notes), so every candidate is trivially legal once
    // it survives the producer's self-containment guard. `selectPlanTuple` still runs the same
    // floor/margin/Consult machinery every route uses. Boundary edges are not expanded here:
    // the subject's source host is read only at commit, so this attempt carries no
    // facilitating dissolve, and `commitAttempt` refuses a move whose subject has a boundary
    // edge in its source host (a rope lashed to a post can't be put on the table).
    const selection = selectPlanTuple({
        candidates: proposed.candidates,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: () => ({ verdict: 'legal', decidable: true }),
        toConsultAlternative: (candidate) => containmentConsultAlternative(candidate, input.containment),
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
        type: 'ObjectContainment',
        subjectId: candidate.candidateId.subjectId,
        targetId: candidate.candidateId.targetId,
        hostId: hostRoomId,
        containment: input.containment,
        confidence: intentConfidence,
        attempt: candidate.attempt.toJSON(),
    }
}
