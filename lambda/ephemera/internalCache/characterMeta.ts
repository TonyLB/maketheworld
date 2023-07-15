import { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { nonLegacyEphemeraDB as ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
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
    async get(characterId: EphemeraCharacterId, options: { check: true }): Promise<CharacterMetaItem | undefined>
    async get(characterId: EphemeraCharacterId, options?: { check: false }): Promise<CharacterMetaItem>
    async get(characterId: EphemeraCharacterId, options?: { check: boolean }): Promise<CharacterMetaItem | undefined> {
        if (!(this.CharacterMetaById[characterId])) {
            const characterData = await ephemeraDB.getItem<Omit<CharacterMetaItem, 'RoomId' | 'HomeId' > & { RoomId?: string; HomeId?: string; }>({
                    Key: {
                        EphemeraId: characterId,
                        DataCategory: 'Meta::Character'
                    },
                    ProjectionFields: ['EphemeraId', 'Name', 'RoomId', 'Color', 'fileURL', 'HomeId', 'assets', 'Pronouns']
                }) || { EphemeraId: '', Name: '', RoomId: 'VORTEX', Color: 'grey', fileURL: '', HomeId: 'VORTEX', assets: [], Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' } }
            if (options?.check && !characterData.EphemeraId) {
                return undefined
            }
            this.CharacterMetaById[characterId] = {
                ...characterData,
                assets: characterData.assets || [],
                RoomId: `ROOM#${characterData.RoomId || characterData.HomeId || 'VORTEX'}`,
                HomeId: `ROOM#${characterData.HomeId || 'VORTEX'}`,
                EphemeraId: characterId
            }
        }
        return this.CharacterMetaById[characterId]
    }
    set(characterItem: CharacterMetaItem): void {
        this.CharacterMetaById[characterItem.EphemeraId] = characterItem
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
