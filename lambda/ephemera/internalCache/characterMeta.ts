import { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { DEFAULT_ROOM_STACK } from '../dataSource/characters/roomStack/trimEvictionLadder';
import type { RoomStackItem } from '../dataSource/characters/roomStack/types';

export type CharacterMetaItem = {
    EphemeraId: EphemeraCharacterId;
    Name: string;
    RoomStack: RoomStackItem[];
    Color?: LegalCharacterColor;
    fileURL?: string;
    HomeId: EphemeraRoomId;
    assets: string[];
    Pronouns?: string;
    player?: string;
}

type CharacterMetaFetch = Omit<CharacterMetaItem, 'HomeId'> & { HomeId?: string; }

export class CacheCharacterMetaData {
    CharacterMetaById: Record<EphemeraCharacterId, CharacterMetaItem> = {};
    clear() {
        this.CharacterMetaById = {}
    }
    invalidate(characterId: EphemeraCharacterId): void {
        delete this.CharacterMetaById[characterId]
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
                    ProjectionFields: ['EphemeraId', 'Name', 'RoomStack', 'Color', 'fileURL', 'HomeId', 'assets', 'Pronouns', 'player']
                }) || { EphemeraId: 'CHARACTER#', Name: '', RoomStack: DEFAULT_ROOM_STACK, Color: 'grey', fileURL: '', HomeId: 'VORTEX', assets: [], Pronouns: 'they/them' }
            if (options?.check && !(characterData.EphemeraId.split('#').slice(1)[0])) {
                return undefined
            }
            this.CharacterMetaById[characterId] = {
                ...characterData,
                assets: [...(characterData.assets || [])],
                RoomStack: characterData.RoomStack ?? DEFAULT_ROOM_STACK,
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

export default CacheCharacterMetaData
