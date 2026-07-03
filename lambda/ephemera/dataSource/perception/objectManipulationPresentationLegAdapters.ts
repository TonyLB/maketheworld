/**
 * Object manipulation presentation fan-in ingress: envelope guards and leg mappers for
 * mtw.ephemera.actions Object Take Hold / Object Drop and mtw.ephemera.positions Object Moved.
 */
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ObjectDropPublishedPayload, ObjectTakeHoldPublishedPayload } from '../actions/publishedEvents'
import {
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    isObjectDropPublishedPayload,
    isObjectTakeHoldPublishedPayload,
} from '../actions/publishedEvents'
import type { ObjectMovedPublishedPayload } from '../positions/publishedEvents'
import {
    EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
    isObjectMovedPublishedPayload,
} from '../positions/publishedEvents'
import type { ObjectManipulationPresentationLeg } from './objectManipulationPresentationFanIn'

export type PerceptionActionsObjectTakeHoldHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Take Hold' }

export type PerceptionActionsObjectDropHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Object Drop' }

export type PerceptionPositionsObjectMovedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Moved' }

export type PerceptionObjectManipulationPresentationSubscribedContent =
    | ObjectTakeHoldPublishedPayload
    | ObjectDropPublishedPayload
    | ObjectMovedPublishedPayload

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

const isPerceptionPositionsObjectMovedHeader: HeaderGuard<PerceptionPositionsObjectMovedHeader> = (
    h
): h is PerceptionPositionsObjectMovedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Moved'
)

export const isPerceptionActionsObjectTakeHoldEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectTakeHoldPublishedPayload,
    PerceptionActionsObjectTakeHoldHeader
>(isPerceptionActionsObjectTakeHoldHeader)

export const isPerceptionActionsObjectDropEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectDropPublishedPayload,
    PerceptionActionsObjectDropHeader
>(isPerceptionActionsObjectDropHeader)

export const isPerceptionPositionsObjectMovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectMovedPublishedPayload,
    PerceptionPositionsObjectMovedHeader
>(isPerceptionPositionsObjectMovedHeader)

export const isPerceptionObjectManipulationPresentationEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionObjectManipulationPresentationSubscribedContent> => (
    isPerceptionActionsObjectTakeHoldEnvelope(envelope)
    || isPerceptionActionsObjectDropEnvelope(envelope)
    || isPerceptionPositionsObjectMovedEnvelope(envelope)
)

export const toObjectManipulationPresentationLeg = async (
    envelope: StreamingEventEnvelope<unknown>
): Promise<ObjectManipulationPresentationLeg | undefined> => {
    if (isPerceptionActionsObjectTakeHoldEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectTakeHoldPublishedPayload(content)) {
            return undefined
        }
        return {
            kind: 'intent',
            operation: 'takeHold',
            characterId: content.characterId,
            objectId: content.objectId,
            roomId: content.roomId,
        }
    }

    if (isPerceptionActionsObjectDropEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectDropPublishedPayload(content)) {
            return undefined
        }
        return {
            kind: 'intent',
            operation: 'drop',
            characterId: content.characterId,
            objectId: content.objectId,
            roomId: content.roomId,
        }
    }

    if (isPerceptionPositionsObjectMovedEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isObjectMovedPublishedPayload(content)) {
            return undefined
        }
        return {
            kind: 'fact',
            objectId: content.objectId,
            froms: content.froms,
            to: content.to,
            beatAnchorTime: content.beatAnchorTime,
        }
    }

    return undefined
}
