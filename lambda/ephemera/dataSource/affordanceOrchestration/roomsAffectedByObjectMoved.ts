import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const roomsAffectedByObjectMoved = (args: {
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
}): EphemeraRoomId[] => (
    [...new Set([
        ...args.froms.filter(isEphemeraRoomId),
        ...(args.to && isEphemeraRoomId(args.to) ? [args.to] : []),
    ])]
)
