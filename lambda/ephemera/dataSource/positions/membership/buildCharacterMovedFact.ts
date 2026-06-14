import type { CharacterMovedPublishedPayload } from '../publishedEvents'
import type { MembershipDiff } from './types'

export const buildCharacterMovedFact = (args: {
    characterId: import('@tonylb/mtw-interfaces/ts/baseClasses').EphemeraCharacterId;
    diff: MembershipDiff;
    beatAnchorTime: number;
    characterName?: string;
}): CharacterMovedPublishedPayload | undefined => {
    const { characterId, diff, beatAnchorTime, characterName } = args
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
    }
}
