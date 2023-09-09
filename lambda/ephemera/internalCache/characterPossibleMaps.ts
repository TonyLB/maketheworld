import { EphemeraCharacterId, EphemeraMapId, EphemeraRoomId, isEphemeraMapId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import CacheCharacterMeta, { CacheCharacterMetaData } from './characterMeta';
import { DeferredCache } from './deferredCache';
import CacheGraph, { GraphCacheType } from './graph';

const generateCacheKey = (CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId) => (`${CharacterId}::${EphemeraId}`)

export type CharacterPossibleMapsItem = {
    EphemeraId: EphemeraCharacterId;
    mapsPossible: EphemeraMapId[];
}

export class CacheCharacterPossibleMapsData {
    _Cache: DeferredCache<CharacterPossibleMapsItem> = new DeferredCache();
    _CharacterMeta: CacheCharacterMetaData;
    _Graph: GraphCacheType;
    constructor(characterMeta: CacheCharacterMetaData, Graph: GraphCacheType) {
        this._CharacterMeta = characterMeta
        this._Graph = Graph
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
                const descentGraph = await this._Graph.get([RoomId], 'forward')
                return {
                    EphemeraId: characterId,
                    //
                    // TODO: Limit possible maps by assets available to the character (global and personal ... later story)
                    //
                    mapsPossible: (Object.values(descentGraph.nodes) as { key: string }[]).map(({ key }) => (key)).filter(isEphemeraMapId)
                }
            },
            requiredKeys: [cacheKey],
            transform: (output) => ({ [cacheKey]: output })
        })
        return await this._Cache.get(cacheKey)
    }
}

export const CacheCharacterPossibleMaps = <GBase extends ReturnType<typeof CacheCharacterMeta> & ReturnType<typeof CacheGraph>>(Base: GBase) => {
    return class CacheCharacterPossibleMaps extends Base {
        CharacterPossibleMaps: CacheCharacterPossibleMapsData;

        constructor(...rest: any) {
            super(...rest)
            this.CharacterPossibleMaps = new CacheCharacterPossibleMapsData(this.CharacterMeta, this.Graph)
        }

        override clear() {
            this.CharacterPossibleMaps.clear()
            super.clear()
        }
    }
}

export default CacheCharacterPossibleMaps
