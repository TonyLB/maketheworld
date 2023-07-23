import { EphemeraCharacterId, EphemeraMapId, EphemeraRoomId, isEphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses';
import CacheCharacterMeta, { CacheCharacterMetaData } from './characterMeta';
import { DeferredCache } from './deferredCache';
import GraphCache, { GraphCacheData } from '@tonylb/mtw-utilities/dist/graphStorage/cache';

const generateCacheKey = (CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId) => (`${CharacterId}::${EphemeraId}`)

export type CharacterPossibleMapsItem = {
    EphemeraId: EphemeraCharacterId;
    mapsPossible: EphemeraMapId[];
}

//
// TODO: ISS2723: Refactor CacheCharacterPossibleMaps data to use new Graph rather than legacy Descent
//
export class CacheCharacterPossibleMapsData {
    _Cache: DeferredCache<CharacterPossibleMapsItem> = new DeferredCache();
    _CharacterMeta: CacheCharacterMetaData;
    _Descent: GraphCacheData
    constructor(characterMeta: CacheCharacterMetaData, descent: GraphCacheData) {
        this._CharacterMeta = characterMeta
        this._Descent = descent
    }

    clear() {
        this._Cache.clear()
    }

    invalidate(EphemeraId: EphemeraCharacterId) {
        Object.keys(this._Cache._cache)
            .filter((cacheKey) => (cacheKey.split('::')[0] === EphemeraId))
            .forEach((cacheKey) => {
                this._Cache.invalidate(cacheKey)
            })
    }

    async get(characterId: EphemeraCharacterId, roomId?: EphemeraRoomId): Promise<CharacterPossibleMapsItem> {
        const RoomId = roomId ? roomId : (await this._CharacterMeta.get(characterId)).RoomId
        const cacheKey = generateCacheKey(characterId, RoomId)
        this._Cache.add({
            promiseFactory: async () => {
                const descent = await this._Descent.get(RoomId)
                const descentRoomNode = descent.find(({ EphemeraId }) => (EphemeraId = RoomId))
                return {
                    EphemeraId: characterId,
                    //
                    // TODO: Limit possible maps by assets available to the character (global and personal ... later story)
                    //
                    mapsPossible: (descentRoomNode?.connections || []).map(({ EphemeraId }) => (EphemeraId)).filter(isEphemeraMapId)
                }
            },
            requiredKeys: [cacheKey],
            transform: (output) => ({ [cacheKey]: output })
        })
        return await this._Cache.get(cacheKey)
    }
}

export const CacheCharacterPossibleMaps = <GBase extends ReturnType<typeof CacheCharacterMeta> & ReturnType<typeof GraphCache>>(Base: GBase) => {
    return class CacheCharacterPossibleMaps extends Base {
        CharacterPossibleMaps: CacheCharacterPossibleMapsData;

        constructor(...rest: any) {
            super(...rest)
            this.CharacterPossibleMaps = new CacheCharacterPossibleMapsData(this.CharacterMeta, this.Descent)
        }

        override clear() {
            this.CharacterPossibleMaps.clear()
            super.clear()
        }
    }
}

export default CacheCharacterPossibleMaps
