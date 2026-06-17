import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { CharacterMovedPublishedPayload, PositionsPublishedPayload } from '../publishedEvents'
import { publishCharacterMovedStreamEvent } from '../publishedEvents'

/** Streams Character Moved at persistence apply (F1-8 graph-diff). */
export const streamMembershipFact = async (
    payload: CharacterMovedPublishedPayload,
    deps: { streamEvent: StreamEventFunction<PositionsPublishedPayload> }
): Promise<void> => {
    await publishCharacterMovedStreamEvent(deps.streamEvent, payload.characterId, payload)
}
