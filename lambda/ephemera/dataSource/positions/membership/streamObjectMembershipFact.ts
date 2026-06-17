import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { ObjectMovedPublishedPayload, PositionsPublishedPayload } from '../publishedEvents'
import { publishObjectMovedStreamEvent } from '../publishedEvents'

/** Streams Object Moved at persistence apply (I4 graph-diff). */
export const streamObjectMembershipFact = async (
    payload: ObjectMovedPublishedPayload,
    deps: { streamEvent: StreamEventFunction<PositionsPublishedPayload> }
): Promise<void> => {
    await publishObjectMovedStreamEvent(deps.streamEvent, payload.objectId, payload)
}
