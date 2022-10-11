import { EphemeraCharacterId, EphemeraMapId, isEphemeraMapId } from '../cacheAsset/baseClasses';
import CacheCharacterMeta, { CacheCharacterMetaData } from './characterMeta';
import { DeferredCache } from './deferredCache';
import DependencyGraph, { DependencyGraphData } from './dependencyGraph';

export type CharacterPossibleMapsItem = {
    EphemeraId: EphemeraCharacterId;
    mapsPossible: EphemeraMapId[];
}

export class CacheCharacterPossibleMapsData {
    _Cache: DeferredCache<CharacterPossibleMapsItem> = new DeferredCache();
    _CharacterMeta: CacheCharacterMetaData;
    _Descent: DependencyGraphData
    constructor(characterMeta: CacheCharacterMetaData, descent: DependencyGraphData) {
        this._CharacterMeta = characterMeta
        this._Descent = descent
    }

    clear() {
        this._Cache.clear()
    }

    invalidate(EphemeraId: EphemeraCharacterId) {
        this._Cache.invalidate(EphemeraId)
    }

    async get(characterId: EphemeraCharacterId): Promise<CharacterPossibleMapsItem> {
        this._Cache.add({
            promiseFactory: async () => {
                const { RoomId } = await this._CharacterMeta.get(characterId)
                const descent = await this._Descent.get(RoomId)
                return {
                    EphemeraId: characterId,
                    mapsPossible: Object.keys(descent).filter(isEphemeraMapId)
                }
            },
            requiredKeys: [characterId],
            transform: (output) => ({ [characterId]: output })
        })
        return await this._Cache.get(characterId)
    }
}

export const CacheCharacterPossibleMaps = <GBase extends ReturnType<typeof CacheCharacterMeta> & ReturnType<typeof DependencyGraph>>(Base: GBase) => {
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
