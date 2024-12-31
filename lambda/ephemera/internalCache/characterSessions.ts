import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'

export class CacheCharacterSessionsData {
    CharacterSessionsById: Record<EphemeraCharacterId, Promise<string[] | undefined>> = {};
    clear() {
        this.CharacterSessionsById = {}
    }
    async get(characterId: EphemeraCharacterId): Promise<string[] | undefined> {
        if (!(this.CharacterSessionsById[characterId])) {
            this.CharacterSessionsById[characterId] = connectionDB.getItem<{ sessions: string[] }>({
                    Key: {
                        ConnectionId: characterId,
                        DataCategory: 'Meta::Character'
                    },
                    ProjectionFields: ['sessions'],
                }).then((value) => (value?.sessions))
        }
        return await this.CharacterSessionsById[characterId]
    }

    set(characterId: EphemeraCharacterId, sessions: string[]): void {
        this.CharacterSessionsById[characterId] = Promise.resolve(sessions)
    }
}

export default CacheCharacterSessionsData
