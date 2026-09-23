import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

type NonRoomCacheHostId = EphemeraObjectId | EphemeraFeatureId | EphemeraCharacterId

const isNonRoomCacheHostId = (id: EphemeraMembershipHostId): id is NonRoomCacheHostId => (
    isEphemeraObjectId(id) || isEphemeraFeatureId(id) || isEphemeraCharacterId(id)
)

export const nonRoomHostsAffectedByObjectMoved = (args: {
    froms: EphemeraMembershipHostId[];
    to: EphemeraMembershipHostId | null;
}): NonRoomCacheHostId[] => (
    [...new Set([
        ...args.froms.filter(isNonRoomCacheHostId),
        ...(args.to && isNonRoomCacheHostId(args.to) ? [args.to] : []),
    ])]
)
