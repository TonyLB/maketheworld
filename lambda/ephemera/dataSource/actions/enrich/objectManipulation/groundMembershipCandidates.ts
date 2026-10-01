import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { CommandAttempt } from '../../commandAttempt'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { adjudicateAttempt } from '../../commandAttempt/adjudicate'
import { attemptActionsFromBoundaryOutcomes } from '../../commandAttempt/expandBoundaryChallenges'
import { buildCommandAttemptReferent } from '../../commandAttempt/referent'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
    withGroundedId,
    type TransferMembershipChange,
} from './plan/planStep'
import type { SandboxState } from './sandboxState'
import type { SpanCandidateLocus } from './spanResolution'

/**
 * An (identity, plan) tuple grounded into its attempt: the selection unit on the
 * membership route. `desiredResult` is the exact value the attempt's primary action
 * wraps, carried alongside so `sandboxMembershipDryRun` seeds the executor from it
 * without narrowing the attempt's action family. Its `object` carries the candidate's
 * `groundedId`; `from`/`to` stay derived, since this stage knows only the object.
 */
export type GroundedMembershipCandidate = IdentityPlanCandidate & {
    desiredResult: TransferMembershipChange
    attempt: CommandAttempt
}

export type GroundMembershipCandidatesContext = {
    /** The player's words, verbatim. */
    words: string
    /** The object phrase the desired result refers to. */
    span: string
    catalog: readonly ObjectManipulationCatalogEntry[]
    sandboxState: SandboxState
    roomId?: EphemeraRoomId
    actorCharacterId?: EphemeraCharacterId
}

/**
 * `refKey` is synthesized, not carried from a Parse-stamped `stableRefKey`: this route
 * has no tokenized skeleton to stamp one onto (relational-route-only machinery) --- see
 * `AGENT.concepts.md`'s Parse section.
 */
const primaryObjectRefKey = 'primaryObject'

/**
 * Plan's half of a membership attempt: depends only on the operation and the object
 * phrase, not on which identity candidate it is paired with.
 */
export const planMembershipDesiredResult = (
    operationKind: 'takeHold' | 'drop',
    span: string,
    refKey: string = primaryObjectRefKey
): TransferMembershipChange => ({
    kind: 'change',
    primitive: 'transferMembership',
    object: objectSpanRef(span, refKey),
    from: operationKind === 'takeHold' ? currentHostRef(actingCharacterRef) : actingCharacterRef,
    to: operationKind === 'takeHold' ? actingCharacterRef : currentHostRef(actingCharacterRef),
})

/**
 * The object's actual host, read off its locus --- independent of which operation a
 * candidate claims. Expansion needs this (boundary edges live on the graph the object is
 * really on, whichever operation is proposed); so does exit-edge escalation. Undefined for
 * loci that are not closed-world atomic in v1 (another character's inventory, inside an
 * object), and when the relevant host id is missing. Validation (`validateMembershipPlanDryRun`)
 * is the one place this gets compared against what the step's `from` referent requires.
 */
export const membershipSourceHostId = (
    locus: SpanCandidateLocus,
    roomId: EphemeraRoomId | undefined,
    actorCharacterId: EphemeraCharacterId | undefined
): EphemeraMembershipHostId | undefined => {
    if (locus.kind === 'room') {
        return roomId
    }
    if (locus.kind === 'heldByActor') {
        return actorCharacterId
    }
    return undefined
}

/**
 * Ground + expand + adjudicate, run before scoring: one grounded, adjudicated attempt per
 * (identity, plan) tuple. Grounding adds the candidate's id to Plan's object referent
 * (keeping its span and `stableRefKey`) and ties the phrase to the candidate's catalog entry
 * (short name, gloss). Expansion adds one facilitating action per boundary edge from the
 * candidate's source graph, with a graph challenge on each `defer`. Adjudicate then judges
 * the challenges it may (`adjudicateAttempt`), so the dry run validates a judged attempt. A
 * candidate with no source graph grounds its referent but skips expansion.
 *
 * Kept out of the selector's `dryRun` callback, which maps one candidate to one outcome:
 * a sibling attempt (a plan without this precondition, e.g. taking part of a lashed
 * rope) comes into being at expansion, so the pool is built here. This is a `map` today
 * and becomes a `flatMap` when a sibling producer arrives.
 */
export const groundMembershipCandidates = (
    candidates: readonly IdentityPlanCandidate[],
    context: GroundMembershipCandidatesContext
): GroundedMembershipCandidate[] => {
    const { words, span, catalog, sandboxState, roomId, actorCharacterId } = context
    const catalogById = new Map(catalog.map((entry) => [entry.objectId, entry]))

    const plannedByOperation = new Map<'takeHold' | 'drop', TransferMembershipChange>()
    const planned = (operationKind: 'takeHold' | 'drop'): TransferMembershipChange => {
        const existing = plannedByOperation.get(operationKind)
        if (existing) {
            return existing
        }
        const desiredResult = planMembershipDesiredResult(operationKind, span)
        plannedByOperation.set(operationKind, desiredResult)
        return desiredResult
    }

    return candidates.map((candidate): GroundedMembershipCandidate => {
        const { objectId, locus } = candidate.identity
        const { operationKind } = candidate.plan
        const plannedResult = planned(operationKind)
        const desiredResult: TransferMembershipChange = {
            ...plannedResult,
            object: withGroundedId(plannedResult.object, objectId),
        }

        const catalogEntry = catalogById.get(objectId)
        const shortName = catalogEntry?.normalizedShortName ?? span
        const referent = buildCommandAttemptReferent(primaryObjectRefKey, objectId, shortName, catalogEntry?.gloss)
        const primaryAction = new PositionAttemptAction(
            [],
            desiredResult,
            `${operationKind === 'takeHold' ? 'Take' : 'Drop'}: ${shortName}`
        )

        const sourceHostId = membershipSourceHostId(locus, roomId, actorCharacterId)
        const sourceGraph = sourceHostId !== undefined ? sandboxState.get(sourceHostId) : undefined
        const actions = sourceGraph !== undefined
            ? attemptActionsFromBoundaryOutcomes(primaryAction, new Set([objectId]), sourceGraph)
            : [primaryAction]

        return {
            ...candidate,
            desiredResult,
            attempt: adjudicateAttempt(CommandAttempt.create(words, [referent], actions)),
        }
    })
}
