import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { applyObjectRelationalChange } from './applyObjectRelationalChange'

export type ExecuteObjectDissolveRelationArgs = {
    characterId: EphemeraCharacterId
    subjectId: EphemeraObjectId
    targetId: EphemeraObjectId
    hostId: EphemeraMembershipHostId
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
} & RelationalKindAndLabel

export const executeObjectDissolveRelation = async (
    args: ExecuteObjectDissolveRelationArgs
): Promise<void> => {
    void args.characterId
    await applyObjectRelationalChange(
        {
            subjectId: args.subjectId,
            targetId: args.targetId,
            hostId: args.hostId,
            ...relationKindAndLabelFrom(args),
            operation: 'dissolve',
        },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
        }
    )
}
