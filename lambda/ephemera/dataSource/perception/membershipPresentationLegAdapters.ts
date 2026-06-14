/**
 * Membership presentation fan-in ingress: envelope guards and leg mappers for
 * mtw.ephemera.actions, mtw.connections.characters, and mtw.ephemera.positions.
 */
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    isConnectionsCharactersConnectedEvent,
    isConnectionsCharactersDisconnectedEvent,
    type ConnectionsCharactersEventUpdate,
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type {
    CharacterHomePublishedPayload,
    CharacterNavigatePublishedPayload,
} from '../actions/publishedEvents'
import {
    isCharacterHomePublishedPayload,
    isCharacterNavigatePublishedPayload,
} from '../actions/publishedEvents'
import { EPHEMERA_ACTIONS_DATA_SOURCE_KEY } from '../actions/sendPublishedEvents'
import type { CharacterMovedPublishedPayload } from '../positions/publishedEvents'
import {
    EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
    isCharacterMovedPublishedPayload,
} from '../positions/publishedEvents'
import type { MembershipPresentationLeg } from './membershipPresentationFanIn'

export type PerceptionActionsCharacterNavigateHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Character Navigate' }

export type PerceptionActionsCharacterHomeHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY; type: 'Character Home' }

export type PerceptionConnectionsCharactersHeader =
    StreamingEventHeader & {
        dataSourceKey: 'mtw.connections.characters';
        type: 'Character Connected' | 'Character Disconnected';
    }

export type PerceptionPositionsCharacterMovedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Character Moved' }

export type PerceptionMembershipPresentationSubscribedContent =
    | CharacterNavigatePublishedPayload
    | CharacterHomePublishedPayload
    | ConnectionsCharactersEventUpdate
    | CharacterMovedPublishedPayload

const isPerceptionActionsCharacterNavigateHeader: HeaderGuard<PerceptionActionsCharacterNavigateHeader> = (
    h
): h is PerceptionActionsCharacterNavigateHeader => (
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === 'Character Navigate'
)

const isPerceptionActionsCharacterHomeHeader: HeaderGuard<PerceptionActionsCharacterHomeHeader> = (
    h
): h is PerceptionActionsCharacterHomeHeader => (
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === 'Character Home'
)

const isPerceptionConnectionsCharactersHeader: HeaderGuard<PerceptionConnectionsCharactersHeader> = (
    h
): h is PerceptionConnectionsCharactersHeader => (
    h.dataSourceKey === 'mtw.connections.characters' && (
        h.type === 'Character Connected' || h.type === 'Character Disconnected'
    )
)

const isPerceptionPositionsCharacterMovedHeader: HeaderGuard<PerceptionPositionsCharacterMovedHeader> = (
    h
): h is PerceptionPositionsCharacterMovedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Character Moved'
)

export const isPerceptionActionsCharacterNavigateEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterNavigatePublishedPayload,
    PerceptionActionsCharacterNavigateHeader
>(isPerceptionActionsCharacterNavigateHeader)

export const isPerceptionActionsCharacterHomeEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterHomePublishedPayload,
    PerceptionActionsCharacterHomeHeader
>(isPerceptionActionsCharacterHomeHeader)

export const isPerceptionConnectionsCharactersEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsCharactersEventUpdate,
    PerceptionConnectionsCharactersHeader
>(isPerceptionConnectionsCharactersHeader)

export const isPerceptionPositionsCharacterMovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterMovedPublishedPayload,
    PerceptionPositionsCharacterMovedHeader
>(isPerceptionPositionsCharacterMovedHeader)

export const isPerceptionMembershipPresentationEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionMembershipPresentationSubscribedContent> => (
    isPerceptionActionsCharacterNavigateEnvelope(envelope)
    || isPerceptionActionsCharacterHomeEnvelope(envelope)
    || isPerceptionConnectionsCharactersEnvelope(envelope)
    || isPerceptionPositionsCharacterMovedEnvelope(envelope)
)

export const toMembershipPresentationLeg = async (
    envelope: StreamingEventEnvelope<unknown>
): Promise<MembershipPresentationLeg | undefined> => {
    if (isPerceptionActionsCharacterNavigateEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isCharacterNavigatePublishedPayload(content)) {
            return undefined
        }
        return {
            kind: 'intent',
            intentKind: 'navigate',
            characterId: content.characterId,
            fromRoomId: content.fromRoomId,
            toRoomId: content.toRoomId,
            ...(content.exitName !== undefined ? { exitName: content.exitName } : {}),
        }
    }

    if (isPerceptionActionsCharacterHomeEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isCharacterHomePublishedPayload(content)) {
            return undefined
        }
        return {
            kind: 'intent',
            intentKind: 'home',
            characterId: content.characterId,
            fromRoomId: content.fromRoomId,
            toRoomId: content.toRoomId,
        }
    }

    if (isPerceptionConnectionsCharactersEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (isConnectionsCharactersConnectedEvent(content)) {
            return {
                kind: 'intent',
                intentKind: 'connect',
                characterId: content.characterId,
            }
        }
        if (isConnectionsCharactersDisconnectedEvent(content)) {
            return {
                kind: 'intent',
                intentKind: 'disconnect',
                characterId: content.characterId,
            }
        }
        return undefined
    }

    if (isPerceptionPositionsCharacterMovedEnvelope(envelope)) {
        const content = await envelope.getContent()
        if (!isCharacterMovedPublishedPayload(content)) {
            return undefined
        }
        return {
            kind: 'fact',
            characterId: content.characterId,
            froms: content.froms,
            to: content.to,
            beatAnchorTime: content.beatAnchorTime,
            legalExits: content.legalExits,
            characterName: content.characterName,
        }
    }

    return undefined
}
