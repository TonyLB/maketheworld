import { v4 as uuidv4 } from 'uuid'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { MoveCharacterMessage, MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import type { CharacterMetaItem } from '../internalCache/characterMeta'
import {
    getCharacterRoomPerspectiveKey,
    kickPassiveRenderRequestedForCharacterInRoom,
} from '../dataSource/perception/kickRoomHeaderBroadcast'

export type OrchestrateCharacterNavigateArgs = {
    payload: MoveCharacterMessage;
    characterMeta: CharacterMetaItem;
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    beatAnchorTime?: number;
    messageBus: MessageBus;
}

/**
 * Post-persist navigate presentation (S1-13): PerceptionThreads header targeting,
 * passive render kick, imperative header fallback, MapUpdate.
 * Does not perform membership Dynamo writes or RoomUpdate / EphemeraUpdate (coordinator owns those).
 */
export const orchestrateCharacterNavigate = async ({
    payload,
    characterMeta,
    froms,
    to,
    beatAnchorTime,
    messageBus,
}: OrchestrateCharacterNavigateArgs): Promise<void> => {
    if (!to || (froms.length === 1 && froms[0] === to)) {
        return
    }

    // Temporary singular bridge: MapUpdate still takes one room; fan-in owns multi-departure leave.
    const primaryDeparture = froms[0] ?? characterMeta.RoomId

    const messageGroupId = internalCache.OrchestrateMessages.newMessageGroup()
    let registeredCharacterMove = false

    const perspectiveKey = await getCharacterRoomPerspectiveKey(
        to,
        characterMeta.assets || []
    )
    if (perspectiveKey) {
        const registrationId = uuidv4()
        const headerMessageId = beatAnchorTime !== undefined ? `MESSAGE#${uuidv4()}` : undefined
        internalCache.PerceptionThreads.register({
            threadKind: 'characterMove',
            componentId: to,
            perspectiveKey,
            characterId: payload.characterId,
            targets: [payload.characterId],
            messageGroupId,
            registrationId,
            ...(headerMessageId !== undefined ? { messageId: headerMessageId } : {}),
            ...(beatAnchorTime !== undefined ? { createdTime: beatAnchorTime } : {}),
        })
        registeredCharacterMove = true
    }

    const kickedPassiveRender = await kickPassiveRenderRequestedForCharacterInRoom({
        roomId: to,
        characterId: payload.characterId,
        assets: characterMeta.assets || [],
        messageBus,
    })

    if (!registeredCharacterMove && !kickedPassiveRender) {
        messageBus.publish({
            type: 'Perception',
            characterId: payload.characterId,
            ephemeraId: to,
            header: true,
            messageGroupId,
        })
    }

    messageBus.publish({
        type: 'MapUpdate',
        characterId: payload.characterId,
        previousRoomId: primaryDeparture,
        roomId: to,
    })
}
