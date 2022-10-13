import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/ephemera'
import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

export class CacheCharacterConnectionsData {
    CharacterConnectionsById: Record<EphemeraCharacterId, Promise<string[] | undefined>> = {};
    clear() {
        this.CharacterConnectionsById = {}
    }
    async get(characterId: EphemeraCharacterId): Promise<string[] | undefined> {
        if (!(this.CharacterConnectionsById[characterId])) {
            this.CharacterConnectionsById[characterId] = connectionDB.getItem<{ connections: string[] }>({
                    ConnectionId: characterId,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['connections'],
                }).then((value) => (value?.connections))
        }
        return await this.CharacterConnectionsById[characterId]
    }
}

export const CacheCharacterConnections = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheCharacterConnections extends Base {
        CharacterConnections: CacheCharacterConnectionsData = new CacheCharacterConnectionsData()

        override clear() {
            this.CharacterConnections.clear()
            super.clear()
        }
    }
}

export default CacheCharacterConnections
