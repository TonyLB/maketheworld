import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'

export type ExecuteObjectTakeHoldArgs = {
    characterId: EphemeraCharacterId;
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/** Phase 3 stub: ingress wired; graph apply lands Phase 4 (D16, D8). */
export const executeObjectTakeHold = async (_args: ExecuteObjectTakeHoldArgs): Promise<void> => {
    // no-op until Phase 4
}
