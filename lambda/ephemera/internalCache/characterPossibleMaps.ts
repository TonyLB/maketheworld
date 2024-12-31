import { EphemeraCharacterId, EphemeraMapId, EphemeraRoomId, isEphemeraMapId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import CacheCharacterMetaData from './characterMeta';
import { DeferredCache } from './deferredCache';
import { GraphCacheType } from './graph';

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
                //
                // TODO: ISS3645: Correct component edgeSet on cacheAsset, so that rooms are showing Maps in their
                // descendants, rather than just other rooms (by exits?)
                //
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

export default CacheCharacterPossibleMapsData
