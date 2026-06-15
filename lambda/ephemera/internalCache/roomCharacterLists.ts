import type { PlayPositionRoomRosterEntry } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { RoomCharacterListItem } from './baseClasses'

export const playPositionRosterEntryToRoomCharacterListItem = (
    entry: PlayPositionRoomRosterEntry
): RoomCharacterListItem => ({
    EphemeraId: entry.EphemeraId,
    DisplayName: entry.DisplayName,
    SessionIds: entry.SessionIds,
    ...(entry.Color !== undefined ? { Color: entry.Color } : {}),
    ...(entry.fileURL !== undefined ? { fileURL: entry.fileURL } : {}),
})

export class CacheRoomCharacterListsData {
    CharacterListByRoom: Record<EphemeraRoomId, RoomCharacterListItem[]> = {}
    _getRoomRoster: (roomId: EphemeraRoomId) => Promise<PlayPositionRoomRosterEntry[]>

    constructor(getRoomRoster: (roomId: EphemeraRoomId) => Promise<PlayPositionRoomRosterEntry[]>) {
        this._getRoomRoster = getRoomRoster
    }

    clear() {
        this.CharacterListByRoom = {}
    }

    async get(roomId: EphemeraRoomId): Promise<RoomCharacterListItem[]> {
        if (!this.CharacterListByRoom[roomId]) {
            const roster = await this._getRoomRoster(roomId)
            this.CharacterListByRoom[roomId] = roster.map(playPositionRosterEntryToRoomCharacterListItem)
        }
        return this.CharacterListByRoom[roomId] || []
    }

    set(props: { key: EphemeraRoomId; value: RoomCharacterListItem[] }) {
        this.CharacterListByRoom[props.key] = props.value
    }

    invalidate(key: EphemeraRoomId) {
        delete this.CharacterListByRoom[key]
    }
}

export default CacheRoomCharacterListsData
