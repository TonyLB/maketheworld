import type { CharacterMovedPublishedPayload } from '../publishedEvents'
import type { MembershipApplySuccessResult } from './types'

/**
 * TEMP slice 1 --- replace with MembershipDiff from updatePositionGraphs in slice 2.
 *
 * Builds a Character Moved fact payload from a successful membership apply result.
 * Slice 1b wires this into streamMembershipFact at persistence apply (S1-14).
 */
export const buildCharacterMovedFact = (args: {
    characterId: import('@tonylb/mtw-interfaces/ts/baseClasses').EphemeraCharacterId;
    applyResult: Pick<MembershipApplySuccessResult, 'from' | 'to' | 'beatAnchorTime'>;
    characterName?: string;
}): CharacterMovedPublishedPayload | undefined => {
    const { characterId, applyResult, characterName } = args
    if (!applyResult.beatAnchorTime) {
        return undefined
    }
    const froms = applyResult.from ? [applyResult.from] : []
    if (froms.length > 1) {
        return undefined
    }
    return {
        type: 'Character Moved',
        characterId,
        froms,
        to: applyResult.to,
        beatAnchorTime: applyResult.beatAnchorTime,
        ...(characterName !== undefined ? { characterName } : {}),
    }
}
