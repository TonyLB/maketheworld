/**
 * Object manipulation presentation fan-in ingress: envelope guards and leg mappers for
 * mtw.ephemera.actions Object Take Hold / Object Drop / Object Establish Relation /
 * Object Dissolve Relation and mtw.ephemera.positions Object Moved / Object Relation Changed.
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
    ObjectDropPublishedPayload,
    ObjectEstablishRelationPublishedPayload,
    ObjectTakeHoldPublishedPayload,
} from '../actions/publishedEvents'
import {
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    isObjectDissolveRelationPublishedPayload,
    isObjectDropPublishedPayload,
    isObjectEstablishRelationPublishedPayload,
    isObjectTakeHoldPublishedPayload,
} from '../actions/publishedEvents'
import type { ObjectMovedPublishedPayload, ObjectRelationChangedPublishedPayload } from '../positions/publishedEvents'
import {
    EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
    isObjectMovedPublishedPayload,
    isObjectRelationChangedPublishedPayload,
} from '../positions/publishedEvents'
import type { ObjectManipulationPresentationLeg } from './objectManipulationPresentationFanIn'

export type PerceptionActionsObjectTakeHoldHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Take Hold' }

export type PerceptionActionsObjectDropHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Drop' }

export type PerceptionActionsObjectEstablishRelationHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Establish Relation' }

export type PerceptionActionsObjectDissolveRelationHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Dissolve Relation' }

export type PerceptionPositionsObjectMovedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Moved' }

export type PerceptionPositionsObjectRelationChangedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Relation Changed' }

export type PerceptionObjectManipulationPresentationSubscribedContent =
    | ObjectTakeHoldPublishedPayload
    | ObjectDropPublishedPayload
    | ObjectEstablishRelationPublishedPayload
    | ObjectDissolveRelationPublishedPayload
    | ObjectMovedPublishedPayload
    | ObjectRelationChangedPublishedPayload

const isPerceptionActionsObjectTakeHoldHeader: HeaderGuard<PerceptionActionsObjectTakeHoldHeader> = (
    h
): h is PerceptionActionsObjectTakeHoldHeader => (
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === 'Object Take Hold'
)

const isPerceptionActionsObjectDropHeader: HeaderGuard<PerceptionActionsObjectDropHeader> = (
    h
): h is PerceptionActionsObjectDropHeader => (
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === 'Object Drop'
)

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

const isPerceptionPositionsObjectMovedHeader: HeaderGuard<PerceptionPositionsObjectMovedHeader> = (
    h
): h is PerceptionPositionsObjectMovedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Moved'
)

const isPerceptionPositionsObjectRelationChangedHeader: HeaderGuard<PerceptionPositionsObjectRelationChangedHeader> = (
    h
): h is PerceptionPositionsObjectRelationChangedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Relation Changed'
)

export const isPerceptionActionsObjectTakeHoldEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectTakeHoldPublishedPayload,
    PerceptionActionsObjectTakeHoldHeader
>(isPerceptionActionsObjectTakeHoldHeader)

export const isPerceptionActionsObjectDropEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectDropPublishedPayload,
    PerceptionActionsObjectDropHeader
>(isPerceptionActionsObjectDropHeader)

export const isPerceptionActionsObjectEstablishRelationEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectEstablishRelationPublishedPayload,
    PerceptionActionsObjectEstablishRelationHeader
>(isPerceptionActionsObjectEstablishRelationHeader)

export const isPerceptionActionsObjectDissolveRelationEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectDissolveRelationPublishedPayload,
    PerceptionActionsObjectDissolveRelationHeader
>(isPerceptionActionsObjectDissolveRelationHeader)

export const isPerceptionPositionsObjectMovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectMovedPublishedPayload,
    PerceptionPositionsObjectMovedHeader
>(isPerceptionPositionsObjectMovedHeader)

export const isPerceptionPositionsObjectRelationChangedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectRelationChangedPublishedPayload,
    PerceptionPositionsObjectRelationChangedHeader
>(isPerceptionPositionsObjectRelationChangedHeader)

export const isPerceptionObjectManipulationPresentationEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionObjectManipulationPresentationSubscribedContent> => (
    isPerceptionActionsObjectTakeHoldEnvelope(envelope)
    || isPerceptionActionsObjectDropEnvelope(envelope)
    || isPerceptionActionsObjectEstablishRelationEnvelope(envelope)
    || isPerceptionActionsObjectDissolveRelationEnvelope(envelope)
    || isPerceptionPositionsObjectMovedEnvelope(envelope)
    || isPerceptionPositionsObjectRelationChangedEnvelope(envelope)
)

export const toObjectManipulationPresentationLeg = async (
    envelope: StreamingEventEnvelope<unknown>
): Promise<ObjectManipulationPresentationLeg[]> => {
    if (isPerceptionActionsObjectTakeHoldEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectTakeHoldPublishedPayload(content)) {
            return []
        }
        // One intent leg per object in the transfer set (BD-13 carry) --- each object still
        // gets matched against its own `Object Moved` fact leg by the existing per-object
        // cluster mechanism, but only the primary object's cluster (`objectIds[0]`) actually
        // publishes a message; see `buildObjectManipulationEmissionPlan`.
        return content.objectIds.map((objectId) => ({
            kind: 'intent',
            operation: 'takeHold',
            characterId: content.characterId,
            objectId,
            objectIds: content.objectIds,
            roomId: content.roomId,
        }))
    }

    if (isPerceptionActionsObjectDropEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectDropPublishedPayload(content)) {
            return []
        }
        return content.objectIds.map((objectId) => ({
            kind: 'intent',
            operation: 'drop',
            characterId: content.characterId,
            objectId,
            objectIds: content.objectIds,
            roomId: content.roomId,
        }))
    }

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

    if (isPerceptionPositionsObjectMovedEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectMovedPublishedPayload(content)) {
            return []
        }
        return [{
            kind: 'fact',
            objectId: content.objectId,
            froms: content.froms,
            to: content.to,
            beatAnchorTime: content.beatAnchorTime,
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
