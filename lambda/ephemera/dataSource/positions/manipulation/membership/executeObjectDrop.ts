import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { applyObjectSetDrop } from './applyObjectSetDrop'

export type ExecuteObjectDropArgs = {
    characterId: EphemeraCharacterId;
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/**
 * Single call site for every drop command, regardless of transfer-set size
 * (Pipeline A -> B migration Slice 3, 2026-07-15) --- supersedes the singular
 * `applyObjectDrop` path entirely, since `applyObjectSetDrop` handles a set of
 * size 1 identically to a real multi-object carry.
 */
export const executeObjectDrop = async (args: ExecuteObjectDropArgs): Promise<void> => {
    await applyObjectSetDrop(
        {
            objectIds: args.objectIds,
            roomId: args.roomId,
            characterId: args.characterId,
        },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
        }
    )
}
