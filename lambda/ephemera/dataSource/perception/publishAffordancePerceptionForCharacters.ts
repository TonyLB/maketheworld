/**
 * Shared affordance-channel PublishMessage emit: one compose per perspective, one row per delivery.
 */
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import internalCache from '../../internalCache'
import type { MessageBus, PublishTarget } from '../../messageBus/baseClasses'

export type AffordancePerceptionDelivery = {
    targets: readonly PublishTarget[];
}

export type PublishAffordancePerceptionForPerspectiveArgs = {
    roomId: EphemeraRoomId;
    perspectiveKey: string;
    deliveries: readonly AffordancePerceptionDelivery[];
    messageBus: MessageBus;
}

export async function publishAffordancePerceptionForPerspective({
    roomId,
    perspectiveKey,
    deliveries,
    messageBus,
}: PublishAffordancePerceptionForPerspectiveArgs): Promise<void> {
    const nonEmpty = deliveries.filter((delivery) => delivery.targets.length > 0)
    if (!nonEmpty.length) {
        return
    }
    const merged = await internalCache.AffordanceRoomDeliverable.get(roomId, perspectiveKey)
    const wmlContent = schemaToWML([merged.schema])
    for (const { targets } of nonEmpty) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [...targets],
            displayProtocol: 'PerceptionMessage',
            wmlContent,
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                roomChannel: 'affordances',
            },
            messageId: `MESSAGE#${uuidv4()}`,
        })
    }
}

export type PublishAffordancePerceptionForTargetsArgs = {
    roomId: EphemeraRoomId;
    perspectiveKey: string;
    targets: readonly PublishTarget[];
    messageBus: MessageBus;
}

export async function publishAffordancePerceptionForTargets({
    roomId,
    perspectiveKey,
    targets,
    messageBus,
}: PublishAffordancePerceptionForTargetsArgs): Promise<void> {
    await publishAffordancePerceptionForPerspective({
        roomId,
        perspectiveKey,
        deliveries: [{ targets }],
        messageBus,
    })
}

export type PublishAffordancePerceptionForCharactersArgs = {
    roomId: EphemeraRoomId;
    perspectiveKey: string;
    characterIds: readonly EphemeraCharacterId[];
    messageBus: MessageBus;
}

export async function publishAffordancePerceptionForCharacters({
    roomId,
    perspectiveKey,
    characterIds,
    messageBus,
}: PublishAffordancePerceptionForCharactersArgs): Promise<void> {
    if (!characterIds.length) {
        return
    }
    await publishAffordancePerceptionForPerspective({
        roomId,
        perspectiveKey,
        deliveries: characterIds.map((characterId) => ({ targets: [characterId] })),
        messageBus,
    })
}
