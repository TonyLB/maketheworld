import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    CoyoteTropeAffinity,
    EnvironmentAffordanceObject,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

const ROOM_IDS_WITH_ROCK_WALL = new Set<EphemeraRoomId>(['ROOM#VORTEX', 'ROOM#CORNER'])
const ROOM_IDS_WITH_LONG_FALL = new Set<EphemeraRoomId>(['ROOM#CLIFFTOP', 'ROOM#BRIDGE'])
const ROOM_IDS_WITHOUT_CACTUS = new Set<EphemeraRoomId>(['ROOM#BRIDGE'])

function isEnvironmentAffordanceAllowedInRoom(
    affordanceObject: EnvironmentAffordanceObject,
    roomId: EphemeraRoomId
): boolean {
    switch (affordanceObject) {
        case 'rock-wall':
            return ROOM_IDS_WITH_ROCK_WALL.has(roomId)
        case 'long-fall':
            return ROOM_IDS_WITH_LONG_FALL.has(roomId)
        case 'cactus':
            return !ROOM_IDS_WITHOUT_CACTUS.has(roomId)
        case 'boulder':
        case 'tumbleweed':
            return true
        default:
            return false
    }
}

/** Room rules filter only `environmentAffordances`; other trope fields such as `affordancesProvided` are unchanged. */
export const filterTropeAffinitiesByRoom = (
    roomId: EphemeraRoomId
) => (
    tropeAffinities: CoyoteTropeAffinity[]
): CoyoteTropeAffinity[] => (
    tropeAffinities.map((entry) => {
        if (entry.environmentAffordances === undefined) {
            return entry
        }
        return {
            ...entry,
            environmentAffordances: entry.environmentAffordances
                .filter(({ object }) => isEnvironmentAffordanceAllowedInRoom(object, roomId)),
        }
    })
)
