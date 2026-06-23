import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

export const roomsAffectedByObjectMoved = (args: {
    froms: EphemeraMembershipHostId[];
    to: EphemeraMembershipHostId | null;
}): EphemeraRoomId[] => (
    [...new Set([
        ...args.froms.filter(isEphemeraRoomId),
        ...(args.to && isEphemeraRoomId(args.to) ? [args.to] : []),
    ])]
)
