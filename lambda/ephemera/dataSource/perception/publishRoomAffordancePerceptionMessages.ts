/**
 * Legacy export: room-affordance PerceptionMessage for a single perspective group.
 *
 * Production path is handleAffordancesPertain on Affordances Pertain (D38).
 * Retained for tests and hygiene grep; no production callers outside this file.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { MessageGroupId } from '../../internalCache/orchestrateMessages'
import { resolveAffordanceTargetsForPerspective } from './handleAffordancesPertain'
import { publishAffordancePerceptionForCharacters } from './publishAffordancePerceptionForCharacters'

export type PublishRoomAffordancePerceptionMessagesArgs = {
    roomId: EphemeraRoomId;
    perspectiveKey: string;
    messageBus: MessageBus;
    messageGroupId?: MessageGroupId;
}

export async function publishRoomAffordancePerceptionMessages({
    roomId,
    perspectiveKey,
    messageBus,
    messageGroupId,
}: PublishRoomAffordancePerceptionMessagesArgs): Promise<void> {
    const targets = await resolveAffordanceTargetsForPerspective(roomId, perspectiveKey)
    await publishAffordancePerceptionForCharacters({
        roomId,
        perspectiveKey,
        characterIds: targets,
        messageBus,
        messageGroupId,
    })
}
