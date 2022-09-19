import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

export type CharacterMetaItem = {
    EphemeraId: string;
    Name: string;
    RoomId: string;
    Color?: string;
    fileURL?: string;
    HomeId: string;
}

export class CacheCharacterMetaData {
    CharacterMetaById: Record<string, CharacterMetaItem> = {};
    clear() {
        this.CharacterMetaById = {}
    }
    async get(characterId: string): Promise<CharacterMetaItem> {
        if (!this.CharacterMetaById[characterId]) {
            const characterData = await ephemeraDB.getItem<CharacterMetaItem>({
                    EphemeraId: `CHARACTER#${characterId}`,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['activeCharacters']
                }) || { EphemeraId: '', Name: '', RoomId: '', Color: 'grey', HomeId: 'VORTEX' }
            this.CharacterMetaById[characterId] = characterData
        }
        return this.CharacterMetaById[characterId] || []
    }
}

export const CacheCharacterMeta = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheCharacterMeta extends Base {
        CharacterMeta: CacheCharacterMetaData = new CacheCharacterMetaData()

        override clear() {
            this.CharacterMeta.clear()
            super.clear()
        }
    }
}

export default CacheCharacterMeta
