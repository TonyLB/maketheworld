import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { CharacterMovedPublishedPayload } from '../publishedEvents'
import { publishCharacterMovedStreamEvent } from '../publishedEvents'

/**
 * TEMP slice 1 --- replace with MembershipDiff from updatePositionGraphs in slice 2.
 * Streams Character Moved at persistence apply (S1-14).
 */
export const streamMembershipFact = async (
    payload: CharacterMovedPublishedPayload,
    deps: { streamEvent: StreamEventFunction<CharacterMovedPublishedPayload> }
): Promise<void> => {
    await publishCharacterMovedStreamEvent(deps.streamEvent, payload.characterId, payload)
}
