import type { CharacterMovedPublishedPayload } from '../publishedEvents'
import type { MembershipDiff } from './types'

export const buildCharacterMovedFact = (args: {
    characterId: import('@tonylb/mtw-interfaces/ts/baseClasses').EphemeraCharacterId;
    diff: MembershipDiff;
    beatAnchorTime: number;
    characterName?: string;
    /** Phase 2: set when the caller's own compiled step sequence already narrated this move synchronously --- see `CharacterMovedPublishedPayload.narratedInline`. */
    narratedInline?: boolean;
}): CharacterMovedPublishedPayload | undefined => {
    const { characterId, diff, beatAnchorTime, characterName, narratedInline } = args
    if (!diff.changed || !beatAnchorTime) {
        return undefined
    }
    return {
        type: 'Character Moved',
        characterId,
        froms: diff.froms,
        to: diff.to,
        beatAnchorTime,
        ...(characterName !== undefined ? { characterName } : {}),
        ...(narratedInline !== undefined ? { narratedInline } : {}),
    }
}
