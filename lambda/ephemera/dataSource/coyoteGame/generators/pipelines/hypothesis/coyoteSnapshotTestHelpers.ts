import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteRoomObjectSnapshotDeps, CoyoteStagedObject } from '../../../utilities/coyoteRoomObjectSnapshot'

type LegacyRoomObjectRow = {
    objectId: EphemeraObjectId;
    shortName: string;
    stableKey: string;
    tropeAffinities?: CoyoteStagedObject['tropeAffinities'];
    tropeAffinitiesFailed?: boolean;
}

/** Test helper: build graph+meta snapshot deps from staged object rows. */
export const coyoteSnapshotDepsFromRoomObjects = (
    getGameRooms: () => Promise<string[]>,
    roomObjects: Partial<Record<EphemeraRoomId, LegacyRoomObjectRow[]>>
): CoyoteRoomObjectSnapshotDeps => ({
    getGameRooms,
    getObjectIdsInRoom: async (roomId) => (roomObjects[roomId] ?? []).map((row) => row.objectId),
    getStagedObject: async (objectId) => {
        for (const rows of Object.values(roomObjects)) {
            const row = rows?.find((entry) => entry.objectId === objectId)
            if (row) {
                return {
                    objectId: row.objectId,
                    shortName: row.shortName,
                    stableKey: row.stableKey,
                    ...(row.tropeAffinities !== undefined ? { tropeAffinities: row.tropeAffinities } : {}),
                    ...(row.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true } : {}),
                }
            }
        }
        return undefined
    },
})
