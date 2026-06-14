import { v4 as uuidv4 } from 'uuid'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { MoveCharacterMessage, MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import type { CharacterMetaItem } from '../internalCache/characterMeta'
import {
    getCharacterRoomPerspectiveKey,
    kickPassiveRenderRequestedForCharacterInRoom,
} from '../dataSource/perception/kickRoomHeaderBroadcast'
import { type CharacterMoveDeliveryKey } from '../dataSource/perception/characterMoveDelivery'

export type OrchestrateCharacterNavigateArgs = {
    payload: MoveCharacterMessage;
    characterMeta: CharacterMetaItem;
    from: EphemeraRoomId | null;
    to: EphemeraRoomId | null;
    beatAnchorTime?: number;
    messageBus: MessageBus;
}

/**
 * Post-persist navigate presentation (S1-13): PerceptionThreads header targeting,
 * passive render kick, imperative fallback copy, MapUpdate.
 * Does not perform membership Dynamo writes or RoomUpdate / EphemeraUpdate (coordinator owns those).
 */
export const orchestrateCharacterNavigate = async ({
    payload,
    characterMeta,
    from,
    to,
    beatAnchorTime,
    messageBus,
}: OrchestrateCharacterNavigateArgs): Promise<void> => {
    if (!to || from === to) {
        return
    }

    const messageGroupId = internalCache.OrchestrateMessages.newMessageGroup()
    let characterMoveKey: CharacterMoveDeliveryKey | null = null

    const perspectiveKey = await getCharacterRoomPerspectiveKey(
        to,
        characterMeta.assets || []
    )
    if (perspectiveKey) {
        const leaveMessageGroupId = internalCache.OrchestrateMessages.before(messageGroupId)
        const arriveMessageGroupId = internalCache.OrchestrateMessages.after(messageGroupId)
        const registrationId = uuidv4()
        const headerMessageId = beatAnchorTime !== undefined ? `MESSAGE#${uuidv4()}` : undefined
        internalCache.PerceptionThreads.register({
            threadKind: 'characterMove',
            componentId: to,
            perspectiveKey,
            characterId: payload.characterId,
            departureRoomId: from ?? characterMeta.RoomId,
            messageGroupId,
            leaveMessageGroupId,
            arriveMessageGroupId,
            registrationId,
            ...(headerMessageId !== undefined ? { messageId: headerMessageId } : {}),
            ...(beatAnchorTime !== undefined ? { createdTime: beatAnchorTime } : {}),
            leaveWorldMessage: !payload.suppressDeparture
                ? {
                    targets: [from ?? characterMeta.RoomId, payload.characterId],
                    message: [`${characterMeta.Name || 'Someone'}${payload.leaveMessage || ' has left.'}`],
                }
                : undefined,
            arriveWorldMessage: !payload.suppressArrival
                ? {
                    targets: [
                        to,
                        payload.suppressSelfMessage ? `!${payload.characterId}` : payload.characterId,
                    ],
                    message: [`${characterMeta.Name || 'Someone'}${payload.arriveMessage || ' has arrived.'}`],
                }
                : undefined,
        })
        characterMoveKey = {
            componentId: to,
            perspectiveKey,
            registrationId,
        }
    }

    if (!characterMoveKey && from && !payload.suppressDeparture) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [from, payload.characterId],
            displayProtocol: 'WorldMessage',
            message: [`${characterMeta.Name || 'Someone'}${payload.leaveMessage || ' has left.'}`],
            messageGroupId: internalCache.OrchestrateMessages.before(messageGroupId),
            deliveryMode: 'deferred',
        })
    }

    const kickedPassiveRender = await kickPassiveRenderRequestedForCharacterInRoom({
        roomId: to,
        characterId: payload.characterId,
        assets: characterMeta.assets || [],
        messageBus,
    })

    if (!characterMoveKey && !kickedPassiveRender) {
        messageBus.publish({
            type: 'Perception',
            characterId: payload.characterId,
            ephemeraId: to,
            header: true,
            messageGroupId,
        })
    }

    if (!characterMoveKey && !payload.suppressArrival) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [to, payload.suppressSelfMessage ? `!${payload.characterId}` : payload.characterId],
            displayProtocol: 'WorldMessage',
            message: [`${characterMeta.Name || 'Someone'}${payload.arriveMessage || ' has arrived.'}`],
            messageGroupId: internalCache.OrchestrateMessages.after(messageGroupId),
            deliveryMode: 'deferred',
        })
    }

    messageBus.publish({
        type: 'MapUpdate',
        characterId: payload.characterId,
        previousRoomId: from ?? characterMeta.RoomId,
        roomId: to,
    })
}
