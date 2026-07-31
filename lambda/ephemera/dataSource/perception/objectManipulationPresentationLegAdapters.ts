/**
 * Object *relational* presentation fan-in ingress: envelope guards and leg mappers for
 * mtw.ephemera.actions Object Establish Relation / Object Dissolve Relation and
 * mtw.ephemera.positions Object Relation Changed.
 *
 * Take Hold / Drop / Object Moved left this file in Phase 4: object moves now narrate through the
 * mutation kernel's compiled step sequence and a positionally-captured audience
 * (`positions/manipulation/membership/orchestrateObjectMove.ts`), so there is nothing here to join
 * an intent leg to a fact leg for. `Object Moved` facts are still streamed by `commitStepSequence`;
 * perception simply no longer subscribes to them.
 */
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    ObjectDissolveRelationPublishedPayload,
    ObjectEstablishRelationPublishedPayload,
} from '../actions/publishedEvents'
import {
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    isObjectDissolveRelationPublishedPayload,
    isObjectEstablishRelationPublishedPayload,
} from '../actions/publishedEvents'
import type { ObjectRelationChangedPublishedPayload } from '../positions/publishedEvents'
import {
    EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
    isObjectRelationChangedPublishedPayload,
} from '../positions/publishedEvents'
import type { ObjectManipulationPresentationLeg } from './objectManipulationPresentationFanIn'

export type PerceptionActionsObjectEstablishRelationHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Establish Relation' }

export type PerceptionActionsObjectDissolveRelationHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Dissolve Relation' }

export type PerceptionPositionsObjectRelationChangedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Relation Changed' }

export type PerceptionObjectManipulationPresentationSubscribedContent =
    | ObjectEstablishRelationPublishedPayload
    | ObjectDissolveRelationPublishedPayload
    | ObjectRelationChangedPublishedPayload

const isPerceptionActionsObjectEstablishRelationHeader: HeaderGuard<PerceptionActionsObjectEstablishRelationHeader> = (
    h
): h is PerceptionActionsObjectEstablishRelationHeader => (
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === 'Object Establish Relation'
)

const isPerceptionActionsObjectDissolveRelationHeader: HeaderGuard<PerceptionActionsObjectDissolveRelationHeader> = (
    h
): h is PerceptionActionsObjectDissolveRelationHeader => (
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === 'Object Dissolve Relation'
)

const isPerceptionPositionsObjectRelationChangedHeader: HeaderGuard<PerceptionPositionsObjectRelationChangedHeader> = (
    h
): h is PerceptionPositionsObjectRelationChangedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Relation Changed'
)

export const isPerceptionActionsObjectEstablishRelationEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectEstablishRelationPublishedPayload,
    PerceptionActionsObjectEstablishRelationHeader
>(isPerceptionActionsObjectEstablishRelationHeader)

export const isPerceptionActionsObjectDissolveRelationEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectDissolveRelationPublishedPayload,
    PerceptionActionsObjectDissolveRelationHeader
>(isPerceptionActionsObjectDissolveRelationHeader)

export const isPerceptionPositionsObjectRelationChangedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectRelationChangedPublishedPayload,
    PerceptionPositionsObjectRelationChangedHeader
>(isPerceptionPositionsObjectRelationChangedHeader)

export const isPerceptionObjectManipulationPresentationEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionObjectManipulationPresentationSubscribedContent> => (
    isPerceptionActionsObjectEstablishRelationEnvelope(envelope)
    || isPerceptionActionsObjectDissolveRelationEnvelope(envelope)
    || isPerceptionPositionsObjectRelationChangedEnvelope(envelope)
)

export const toObjectManipulationPresentationLeg = async (
    envelope: StreamingEventEnvelope<unknown>
): Promise<ObjectManipulationPresentationLeg[]> => {
    if (isPerceptionActionsObjectEstablishRelationEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectEstablishRelationPublishedPayload(content) || !isEphemeraRoomId(content.hostId)) {
            // Character-hosted relation narration is unresolved UX/copy design (BD-15/16),
            // same precondition BD-13's carried-set narration had before it shipped ---
            // not built here.
            return []
        }
        return [{
            kind: 'relationalIntent',
            operation: 'establishRelation',
            characterId: content.characterId,
            subjectId: content.subjectId,
            targetId: content.targetId,
            roomId: content.hostId,
            relationKind: content.relationKind,
            ...(content.relationLabel !== undefined ? { relationLabel: content.relationLabel } : {}),
        }]
    }

    if (isPerceptionActionsObjectDissolveRelationEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectDissolveRelationPublishedPayload(content) || !isEphemeraRoomId(content.hostId)) {
            // See the establishRelation branch above --- Character-hosted narration not built yet.
            return []
        }
        return [{
            kind: 'relationalIntent',
            operation: 'dissolveRelation',
            characterId: content.characterId,
            subjectId: content.subjectId,
            targetId: content.targetId,
            roomId: content.hostId,
            relationKind: content.relationKind,
            ...(content.relationLabel !== undefined ? { relationLabel: content.relationLabel } : {}),
        }]
    }

    if (isPerceptionPositionsObjectRelationChangedEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectRelationChangedPublishedPayload(content) || !isEphemeraRoomId(content.hostId)) {
            // See the establishRelation branch above --- Character-hosted narration not built yet.
            return []
        }
        return [{
            kind: 'relationalFact',
            subjectId: content.subjectId,
            targetId: content.targetId,
            hostRoomId: content.hostId,
            relationKind: content.relationKind,
            ...(content.relationLabel !== undefined ? { relationLabel: content.relationLabel } : {}),
            operation: content.operation,
            beatAnchorTime: content.beatAnchorTime,
        }]
    }

    return []
}
