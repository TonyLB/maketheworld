import { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { NormalCharacterPronouns } from '@tonylb/mtw-wml/ts/normalize/baseClasses'
import { CacheConstructor } from './baseClasses'
import { RoomStackItem } from '../moveCharacter';

export type CharacterMetaItem = {
    EphemeraId: EphemeraCharacterId;
    Name: string;
    RoomId: EphemeraRoomId;
    RoomStack: RoomStackItem[];
    Color?: LegalCharacterColor;
    fileURL?: string;
    HomeId: EphemeraRoomId;
    assets: string[];
    Pronouns: NormalCharacterPronouns;
    player?: string;
}

type CharacterMetaFetch = Omit<CharacterMetaItem, 'RoomId' | 'HomeId' > & { RoomId?: string; HomeId?: string; }

const defaultRoomStack = [{ asset: 'primitives', RoomId: 'VORTEX' }]

export class CacheCharacterMetaData {
    CharacterMetaById: Record<EphemeraCharacterId, CharacterMetaItem> = {};
    clear() {
        this.CharacterMetaById = {}
    }
    async get(characterId: EphemeraCharacterId, options: { check: true }): Promise<CharacterMetaItem | undefined>
    async get(characterId: EphemeraCharacterId, options?: { check: false }): Promise<CharacterMetaItem>
    async get(characterId: EphemeraCharacterId, options?: { check: boolean }): Promise<CharacterMetaItem | undefined> {
        if (!(this.CharacterMetaById[characterId])) {
            const characterData: CharacterMetaFetch = await ephemeraDB.getItem<CharacterMetaFetch>({
                    Key: {
                        EphemeraId: characterId,
                        DataCategory: 'Meta::Character'
                    },
                    ProjectionFields: ['EphemeraId', 'Name', 'RoomId', 'RoomStack', 'Color', 'fileURL', 'HomeId', 'assets', 'Pronouns', 'player']
                }) || { EphemeraId: 'CHARACTER#', Name: '', RoomId: 'VORTEX', RoomStack: defaultRoomStack, Color: 'grey', fileURL: '', HomeId: 'VORTEX', assets: [], Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' } }
            if (options?.check && !(characterData.EphemeraId.split('#').slice(1)[0])) {
                return undefined
            }
            const { player } = characterData
            this.CharacterMetaById[characterId] = {
                ...characterData,
                assets: [...(player ? [`draft[${player}]`] : []), ...(characterData.assets || [])],
                RoomId: `ROOM#${characterData.RoomId || characterData.HomeId || 'VORTEX'}`,
                RoomStack: characterData.RoomStack ?? defaultRoomStack,
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
