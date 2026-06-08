/**
 * Shared affordance-channel PublishMessage emit: one row per character via ComponentStackMerge.
 */
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import internalCache from '../../internalCache'
import type { MessageBus, PublishTarget } from '../../messageBus/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'

export type PublishAffordancePerceptionForTargetsArgs = {
    roomId: EphemeraRoomId;
    viewerCharacterId: EphemeraCharacterId;
    targets: readonly PublishTarget[];
    messageBus: MessageBus;
    messageGroupId?: MessageGroupId;
}

export async function publishAffordancePerceptionForTargets({
    roomId,
    viewerCharacterId,
    targets,
    messageBus,
    messageGroupId,
}: PublishAffordancePerceptionForTargetsArgs): Promise<void> {
    if (!targets.length) {
        return
    }
    const merged = await internalCache.ComponentStackMerge.get(viewerCharacterId, roomId)
    const wmlContent = schemaToWML([merged.schema])
    messageBus.send({
        type: 'PublishMessage',
        targets: [...targets],
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

export type PublishAffordancePerceptionForCharactersArgs = {
    roomId: EphemeraRoomId;
    characterIds: readonly EphemeraCharacterId[];
    messageBus: MessageBus;
    messageGroupId?: MessageGroupId;
}

export async function publishAffordancePerceptionForCharacters({
    roomId,
    characterIds,
    messageBus,
    messageGroupId,
}: PublishAffordancePerceptionForCharactersArgs): Promise<void> {
    if (!characterIds.length) {
        return
    }
    for (const characterId of characterIds) {
        await publishAffordancePerceptionForTargets({
            roomId,
            viewerCharacterId: characterId,
            targets: [characterId],
            messageBus,
            messageGroupId,
        })
    }
}
