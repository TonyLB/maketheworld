/**
 * Room-affordance PerceptionMessage: one bus PublishMessage per occupant, ComponentStackMerge (Option B).
 *
 * Future: migrating ComponentStackMerge cache identity from (characterId, roomId) to (componentId, perspectiveKey)
 * (or equivalent) would align stack merge with render / perception perspectiveKey usage.
 */
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'

export type PublishRoomAffordancePerceptionMessagesArgs = {
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    messageGroupId?: MessageGroupId;
}

export async function publishRoomAffordancePerceptionMessages({
    roomId,
    messageBus,
    messageGroupId,
}: PublishRoomAffordancePerceptionMessagesArgs): Promise<void> {
    const occupants = await internalCache.RoomCharacterList.get(roomId)
    if (!occupants?.length) {
        return
    }
    for (const { EphemeraId } of occupants) {
        const characterId = EphemeraId as EphemeraCharacterId
        const merged = await internalCache.ComponentStackMerge.get(characterId, roomId)
        const wmlContent = schemaToWML([merged.schema])
        messageBus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent,
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                roomChannel: 'affordances',
            },
            messageGroupId,
            messageId: `MESSAGE#${uuidv4()}`,
        })
    }
}
