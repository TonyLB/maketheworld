import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { applyObjectTakeHold } from './applyObjectTakeHold'

export type ExecuteObjectTakeHoldArgs = {
    characterId: EphemeraCharacterId;
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

export const executeObjectTakeHold = async (args: ExecuteObjectTakeHoldArgs): Promise<void> => {
    await applyObjectTakeHold(
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
