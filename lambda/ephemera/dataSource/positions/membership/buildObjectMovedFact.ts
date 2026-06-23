import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ObjectMovedPublishedPayload } from '../publishedEvents'
import type { ObjectMembershipDiff } from '../manipulation/membership/types'
import type { MembershipDiff } from './types'

export const buildObjectMovedFact = (args: {
    objectId: EphemeraObjectId;
    diff: MembershipDiff | ObjectMembershipDiff;
    beatAnchorTime: number;
}): ObjectMovedPublishedPayload | undefined => {
    const { objectId, diff, beatAnchorTime } = args
    if (!diff.changed || !beatAnchorTime) {
        return undefined
    }
    return {
        type: 'Object Moved',
        objectId,
        froms: diff.froms,
        to: diff.to,
        beatAnchorTime,
    }
}
