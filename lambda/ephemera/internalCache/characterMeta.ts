import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/ephemera';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { NormalCharacterPronouns } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { CacheConstructor } from './baseClasses'

export type CharacterMetaItem = {
    EphemeraId: EphemeraCharacterId;
    Name: string;
    RoomId: string;
    Color?: string;
    fileURL?: string;
    HomeId: string;
    assets: string[];
    Pronouns: NormalCharacterPronouns;
}

export class CacheCharacterMetaData {
    CharacterMetaById: Record<EphemeraCharacterId, CharacterMetaItem> = {};
    clear() {
        this.CharacterMetaById = {}
    }
    async get(characterId: EphemeraCharacterId): Promise<CharacterMetaItem> {
        if (!(this.CharacterMetaById[characterId])) {
            const characterData = await ephemeraDB.getItem<Omit<CharacterMetaItem, 'EphemeraId'>>({
                    EphemeraId: characterId,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name', 'RoomId', 'Color', 'fileURL', 'HomeId', 'assets', 'Pronouns'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
                }) || { Name: '', RoomId: '', Color: 'grey', fileURL: '', HomeId: 'VORTEX', assets: [], Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' } }
            this.CharacterMetaById[characterId] = {
                ...characterData,
                EphemeraId: characterId
            }
        }
        return this.CharacterMetaById[characterId]
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
