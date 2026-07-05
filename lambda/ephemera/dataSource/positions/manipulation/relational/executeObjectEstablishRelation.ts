import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { applyObjectRelationalChange } from './applyObjectRelationalChange'

export type ExecuteObjectEstablishRelationArgs = {
    characterId: EphemeraCharacterId
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    roomId: EphemeraRoomId
    relationKind: HostRelationalEdgeKind
    relationLabel?: string
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
}

export const executeObjectEstablishRelation = async (
    args: ExecuteObjectEstablishRelationArgs
): Promise<void> => {
    void args.characterId
    await applyObjectRelationalChange(
        {
            subjectId: args.subjectId,
            targetId: args.targetId,
            roomId: args.roomId,
            relationKind: args.relationKind,
            relationLabel: args.relationLabel,
            operation: 'establish',
        },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
        }
    )
}
