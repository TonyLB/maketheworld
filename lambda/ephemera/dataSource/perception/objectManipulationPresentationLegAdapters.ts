/**
 * Object *relational* presentation fan-in ingress: envelope guards and leg mappers for
 * mtw.ephemera.actions Ludic Network Change Requested (its relational actions) and
 * mtw.ephemera.positions Object Relation Changed.
 *
 * Take Hold / Drop / Object Moved left this file in Phase 4: object moves now narrate through the
 * mutation kernel's compiled step sequence and a positionally-captured audience
 * (`positions/manipulation/commitAttempt.ts`), so there is nothing here to join
 * an intent leg to a fact leg for. `Object Moved` facts are still streamed by `commitStepSequence`;
 * perception simply no longer subscribes to them.
 *
 * Re-pointed from `Object Establish Relation`/`Object Dissolve Relation`: those
 * events carried a flat, narration-only `hostId` --- known buggy for a genuine crossing
 * (`AGENT.relationalNarration.planning.md`). The generalized hand-off carries no host at all
 * (a relation's host lives on its chain's legs, not its edge), so this reads the
 * subject's current host fresh, the same way `planRelationalEdgeTransfer.ts` does --- not a
 * regression, since the old flat field was already wrong for a crossing.
 */
import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import type { LudicNetworkChangeRequestedPublishedPayload } from '../actions/publishedEvents'
import {
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    isLudicNetworkChangeRequestedPublishedPayload,
} from '../actions/publishedEvents'
import { CommandAttempt } from '../actions/commandAttempt'
import type { DissolveRelationChange, EstablishRelationChange, GroundedReferent } from '../actions/enrich/objectManipulation/plan/planStep'
import type { ObjectRelationChangedPublishedPayload } from '../positions/publishedEvents'
import {
    EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
    isObjectRelationChangedPublishedPayload,
} from '../positions/publishedEvents'
import type { ObjectManipulationPresentationLeg } from './objectManipulationPresentationFanIn'

export type PerceptionActionsLudicNetworkChangeRequestedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Ludic Network Change Requested' }

export type PerceptionPositionsObjectRelationChangedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Relation Changed' }

export type PerceptionObjectManipulationPresentationSubscribedContent =
    | LudicNetworkChangeRequestedPublishedPayload
    | ObjectRelationChangedPublishedPayload

const isPerceptionActionsLudicNetworkChangeRequestedHeader: HeaderGuard<PerceptionActionsLudicNetworkChangeRequestedHeader> = (
    h
): h is PerceptionActionsLudicNetworkChangeRequestedHeader => (
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === 'Ludic Network Change Requested'
)

const isPerceptionPositionsObjectRelationChangedHeader: HeaderGuard<PerceptionPositionsObjectRelationChangedHeader> = (
    h
): h is PerceptionPositionsObjectRelationChangedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Relation Changed'
)

export const isPerceptionActionsLudicNetworkChangeRequestedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    LudicNetworkChangeRequestedPublishedPayload,
    PerceptionActionsLudicNetworkChangeRequestedHeader
>(isPerceptionActionsLudicNetworkChangeRequestedHeader)

export const isPerceptionPositionsObjectRelationChangedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectRelationChangedPublishedPayload,
    PerceptionPositionsObjectRelationChangedHeader
>(isPerceptionPositionsObjectRelationChangedHeader)

export const isPerceptionObjectManipulationPresentationEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionObjectManipulationPresentationSubscribedContent> => (
    isPerceptionActionsLudicNetworkChangeRequestedEnvelope(envelope)
    || isPerceptionPositionsObjectRelationChangedEnvelope(envelope)
)

/** The first relational action in an attempt, if any --- today's attempts hold exactly one action. */
const firstRelationalChange = (
    attempt: CommandAttempt
): EstablishRelationChange<GroundedReferent> | DissolveRelationChange<GroundedReferent> | undefined => {
    for (const action of attempt.actions()) {
        const desiredResult = action.desiredResult
        if (desiredResult?.kind === 'change' && (desiredResult.primitive === 'establishRelation' || desiredResult.primitive === 'dissolveRelation')) {
            return desiredResult as EstablishRelationChange<GroundedReferent> | DissolveRelationChange<GroundedReferent>
        }
    }
    return undefined
}

export const toObjectManipulationPresentationLeg = async (
    envelope: StreamingEventEnvelope<unknown>
): Promise<ObjectManipulationPresentationLeg[]> => {
    if (isPerceptionActionsLudicNetworkChangeRequestedEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isLudicNetworkChangeRequestedPublishedPayload(content)) {
            return []
        }
        const change = firstRelationalChange(CommandAttempt.fromJSON(content.attempt))
        if (change === undefined) {
            // Membership (take/drop) narrates through the mutation kernel instead ---
            // nothing to join a relational leg for.
            return []
        }
        const subjectId = change.subject.groundedId
        const targetId = change.target.groundedId
        if (!isEphemeraObjectId(subjectId) || !isEphemeraObjectId(targetId)) {
            return []
        }
        const fromHostIds = await internalCache.Positions.getMembershipContainers(subjectId)
        if (fromHostIds.length !== 1 || !isEphemeraRoomId(fromHostIds[0])) {
            // Character-hosted relation narration is unresolved UX/copy design (BD-15/16),
            // same precondition BD-13's carried-set narration had before it shipped ---
            // not built here.
            return []
        }
        return [{
            kind: 'relationalIntent',
            operation: change.primitive,
            characterId: content.characterId,
            subjectId,
            targetId,
            roomId: fromHostIds[0],
            ...relationKindAndLabelFrom(change),
        }]
    }

    if (isPerceptionPositionsObjectRelationChangedEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (
            !isObjectRelationChangedPublishedPayload(content)
            || !isEphemeraRoomId(content.hostId)
            // ObjectRelationChangedPublishedPayload's subjectId/targetId were widened to
            // EphemeraLudicTerminalPrimitive, but this leg (and the whole presentation
            // fan-in it feeds) is still EphemeraObjectId-only --- deliberately deferred,
            // matching the Character-hosted-narration gap above rather than widening the
            // narration stack in this slice. See `ludicGraph/AGENT.md`'s BD-36 paragraph.
            || !isEphemeraObjectId(content.subjectId)
            || !isEphemeraObjectId(content.targetId)
        ) {
            // See the relational-intent branch above --- Character-hosted narration not built yet.
            return []
        }
        return [{
            kind: 'relationalFact',
            subjectId: content.subjectId,
            targetId: content.targetId,
            hostRoomId: content.hostId,
            ...relationKindAndLabelFrom(content),
            operation: content.operation,
            beatAnchorTime: content.beatAnchorTime,
        }]
    }

    return []
}
