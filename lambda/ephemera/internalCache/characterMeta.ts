import { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { NormalCharacterPronouns } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { CacheConstructor } from './baseClasses'

export type CharacterMetaItem = {
    EphemeraId: EphemeraCharacterId;
    Name: string;
    RoomId: EphemeraRoomId;
    Color?: LegalCharacterColor;
    fileURL?: string;
    HomeId: EphemeraRoomId;
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
            const characterData = await ephemeraDB.getItem<Omit<CharacterMetaItem, 'EphemeraId' | 'RoomId' | 'HomeId' > & { RoomId?: string; HomeId?: string; }>({
                    EphemeraId: characterId,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name', 'RoomId', 'Color', 'fileURL', 'HomeId', 'assets', 'Pronouns'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
                }) || { Name: '', RoomId: 'VORTEX', Color: 'grey', fileURL: '', HomeId: 'VORTEX', assets: [], Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' } }
            this.CharacterMetaById[characterId] = {
                ...characterData,
                RoomId: `ROOM#${characterData.RoomId || characterData.HomeId || 'VORTEX'}`,
                HomeId: `ROOM#${characterData.HomeId || 'VORTEX'}`,
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
