import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { RoomCharacterListItem } from './baseClasses'

export class CacheRoomCharacterListsData {
    CharacterListByRoom: Record<EphemeraRoomId, RoomCharacterListItem[]> = {};
    clear() {
        this.CharacterListByRoom = {}
    }

    async get(roomId: EphemeraRoomId): Promise<RoomCharacterListItem[]> {
        if (!this.CharacterListByRoom[roomId]) {
            const { activeCharacters = [] } = (await ephemeraDB.getItem<{
                    activeCharacters: (Omit<RoomCharacterListItem, 'DisplayName' | 'SessionIds'> & { Name?: string; DisplayName?: string; SessionIds?: string[]; sessions?: string[] })[]
                }>({
                    Key: {
                        EphemeraId: roomId,
                        DataCategory: 'Meta::Room'
                    },
                    ProjectionFields: ['activeCharacters']
                })) || { activeCharacters: [] }
            this.CharacterListByRoom[roomId] = activeCharacters.map((c) => {
                const { Name, sessions, ...rest } = c as any
                return {
                    ...rest,
                    DisplayName: (c as any).DisplayName ?? Name ?? '',
                    SessionIds: (c as any).SessionIds ?? sessions ?? []
                } as RoomCharacterListItem
            })
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
