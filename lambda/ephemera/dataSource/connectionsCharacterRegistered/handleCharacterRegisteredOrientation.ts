/**
 * Session orientation kick on `mtw.connections` / `Character Registered`.
 *
 * Resolves room + canon-filtered perspective from `Meta::Character`, registers a
 * channel-specific perception thread with `CHARACTER#` targets, and kicks orchestration
 * with routing identity only (no delivery fields on orchestration ingress).
 *
 * Each orchestration DataSource calls this with its own `channel` so both threads
 * register in parallel without double-registering from a monolithic helper.
 *
 * Cross-layer integration: ../characterRegisteredOrientation.integration.test.ts
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ConnectionsCharacterRegisteredEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import internalCache from '../../internalCache'
import type { PublishTarget } from '../../messageBus/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import { sendAffordancesRequested } from '../affordanceOrchestration/subscribedEvents'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { sendRenderRequested } from '../renderOrchestration/subscribedEvents'

export type SessionOrientationChannel = 'render' | 'affordances'

const LOG_PREFIX = '[mtw.ephemera.connectionsCharacterRegistered] sessionOrientation'

export type SessionOrientationSkipReason = 'no_room' | 'no_perspective'

export type SessionOrientationContext = {
    characterId: EphemeraCharacterId;
    roomId: EphemeraRoomId;
    perspective: Perspective;
    perspectiveKey: string;
    targets: PublishTarget[];
}

export type ResolveSessionOrientationContextDeps = {
    characterMetaGet?: (characterId: EphemeraCharacterId) => Promise<{ RoomId?: EphemeraRoomId; assets?: readonly string[] } | undefined>;
    resolvePerspective?: (
        roomId: EphemeraRoomId,
        characterAssets: readonly string[]
    ) => Promise<{ perspective: Perspective; perspectiveKey: string } | null>;
}

export async function resolveSessionOrientationContext(
    event: ConnectionsCharacterRegisteredEvent,
    deps?: ResolveSessionOrientationContextDeps
): Promise<SessionOrientationContext | null> {
    const { characterId } = event
    const characterMetaGet = deps?.characterMetaGet ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))
    const resolvePerspective = deps?.resolvePerspective ?? resolveCharacterRoomPerspectiveForRoom

    const meta = await characterMetaGet(characterId)
    const roomId = meta?.RoomId
    if (!roomId) {
        return null
    }

    const resolved = await resolvePerspective(roomId, meta.assets ?? [])
    if (!resolved) {
        return null
    }

    const { perspective, perspectiveKey } = resolved
    const targets: PublishTarget[] = [characterId]

    return {
        characterId,
        roomId,
        perspective,
        perspectiveKey,
        targets,
    }
}

async function resolveSessionOrientationSkipReason(
    event: ConnectionsCharacterRegisteredEvent,
    deps?: ResolveSessionOrientationContextDeps
): Promise<SessionOrientationSkipReason> {
    const characterMetaGet = deps?.characterMetaGet ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))
    const meta = await characterMetaGet(event.characterId)
    if (!meta?.RoomId) {
        return 'no_room'
    }
    return 'no_perspective'
}

export async function handleCharacterRegisteredOrientation(
    messageBus: MessageBus,
    event: ConnectionsCharacterRegisteredEvent,
    channel: SessionOrientationChannel,
    deps?: ResolveSessionOrientationContextDeps
): Promise<void> {
    const { characterId, sessionId } = event
    const context = await resolveSessionOrientationContext(event, deps)
    if (!context) {
        const reason = await resolveSessionOrientationSkipReason(event, deps)
        console.log(LOG_PREFIX, {
            event: 'skip',
            channel,
            characterId,
            sessionId,
            reason,
        })
        return
    }

    const { roomId, perspective, perspectiveKey, targets } = context

    if (channel === 'render') {
        sendPerceptionThreadRegistered(messageBus, roomId, {
            threadKind: 'sessionOrientationRender',
            componentId: roomId,
            perspectiveKey,
            characterId,
            targets,
        })
        sendRenderRequested(messageBus, roomId, {
            componentId: roomId,
            perspective,
        }, { useDefaultMessageBusLane: true })
        console.log(LOG_PREFIX, {
            event: 'kicked',
            channel,
            characterId,
            sessionId,
            roomId,
            perspectiveKey,
            targets,
            threadKind: 'sessionOrientationRender',
            orchestrationKick: 'Render Requested',
        })
        return
    }

    sendPerceptionThreadRegistered(messageBus, roomId, {
        threadKind: 'sessionOrientationAffordances',
        componentId: roomId,
        perspectiveKey,
        characterId,
        targets,
    })
    sendAffordancesRequested(messageBus, roomId, {
        roomId,
        perspective,
        reason: 'roster',
    }, { useDefaultMessageBusLane: true })
    console.log(LOG_PREFIX, {
        event: 'kicked',
        channel,
        characterId,
        sessionId,
        roomId,
        perspectiveKey,
        targets,
        threadKind: 'sessionOrientationAffordances',
        orchestrationKick: 'Affordances Requested',
    })
}
