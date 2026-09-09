import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterMovedPublishedPayload } from '../../publishedEvents'
import type { MembershipDiff } from './types'

/**
 * Takes the same host-general `MembershipDiff` shape `buildObjectMovedFact` does --- one diff,
 * computed once by `factsForStep` per `transferMembership` step, for both fact builders --- but
 * `Character Moved` is a Room-only wire fact (a character's membership host is a Room and only a
 * Room, per `AGENT.contract.md`), so this function narrows `diff.froms`/`diff.to` to
 * `MembershipDiff<EphemeraRoomId>`'s shape here, at the one place the narrower shape is actually
 * required, rather than the caller pre-narrowing into a separately-typed diff to satisfy this
 * function's parameter type. A filter, not an assert: this invariant is enforced today by read-side
 * narrowing rather than by refusing an illegal write (see `AGENT.contract.md`'s "currently
 * unenforced, and the failure is silent").
 */
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
        froms: diff.froms.filter(isEphemeraRoomId),
        to: diff.to !== null && isEphemeraRoomId(diff.to) ? diff.to : null,
        beatAnchorTime,
        ...(characterName !== undefined ? { characterName } : {}),
    }
}
