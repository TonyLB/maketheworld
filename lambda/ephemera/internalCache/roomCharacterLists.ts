import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor, RoomCharacterListItem } from './baseClasses'

export class CacheRoomCharacterListsData {
    CharacterListByRoom: Record<string, RoomCharacterListItem[]> = {};
    clear() {
        this.CharacterListByRoom = {}
    }

    async get(roomId: string): Promise<RoomCharacterListItem[]> {
        if (!this.CharacterListByRoom[roomId]) {
            const { activeCharacters = [] } = await ephemeraDB.getItem<{
                    activeCharacters: RoomCharacterListItem[]
                }>({
                    EphemeraId: `ROOM#${roomId}`,
                    DataCategory: 'Meta::Room',
                    ProjectionFields: ['activeCharacters']
                }) || { activeCharacters: [] }
            this.CharacterListByRoom[roomId] = activeCharacters
        }
        return this.CharacterListByRoom[roomId] || []
    }

    set(props: { key: string; value: RoomCharacterListItem[] }) {
        this.CharacterListByRoom[props.key] = props.value
    }

    invalidate(key: string) {
        delete this.CharacterListByRoom[key]
    }
}

export const CacheRoomCharacterLists = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheRoomCharacterLists extends Base {
        RoomCharacterList: CacheRoomCharacterListsData = new CacheRoomCharacterListsData()

        override clear() {
            this.RoomCharacterList.clear()
            super.clear()
        }
    }
}

export default CacheRoomCharacterLists
