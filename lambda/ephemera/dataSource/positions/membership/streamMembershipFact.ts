import type { CharacterMovedPublishedPayload } from '../publishedEvents'

/**
 * TEMP slice 1 --- slice 1b streams Character Moved at persistence apply (S1-14).
 * Not called in slice 1a.
 */
export const streamMembershipFact = async (
    _payload: CharacterMovedPublishedPayload,
    _deps: { streamEvent: unknown }
): Promise<void> => {
    // Slice 1b implementation.
}
