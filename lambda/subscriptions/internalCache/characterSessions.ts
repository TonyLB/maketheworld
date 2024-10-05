import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

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

export const CacheCharacterSessions = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheCharacterSessions extends Base {
        CharacterSessions: CacheCharacterSessionsData = new CacheCharacterSessionsData()

        override clear() {
            this.CharacterSessions.clear()
            super.clear()
        }
    }
}

export default CacheCharacterSessions
