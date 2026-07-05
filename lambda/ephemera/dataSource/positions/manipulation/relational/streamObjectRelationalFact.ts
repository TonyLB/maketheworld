import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { ObjectRelationChangedPublishedPayload, PositionsPublishedPayload } from '../../publishedEvents'
import { publishObjectRelationChangedStreamEvent } from '../../publishedEvents'

export const streamObjectRelationalFact = async (
    payload: ObjectRelationChangedPublishedPayload,
    deps: { streamEvent: StreamEventFunction<PositionsPublishedPayload> }
): Promise<void> => {
    await publishObjectRelationChangedStreamEvent(deps.streamEvent, payload.subjectId, payload)
}
