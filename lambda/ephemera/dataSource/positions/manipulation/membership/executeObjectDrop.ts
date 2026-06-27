import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { applyObjectDrop } from './applyObjectDrop'

export type ExecuteObjectDropArgs = {
    characterId: EphemeraCharacterId;
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

export const executeObjectDrop = async (args: ExecuteObjectDropArgs): Promise<void> => {
    await applyObjectDrop(
        {
            objectId: args.objectId,
            roomId: args.roomId,
            characterId: args.characterId,
        },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
        }
    )
}
