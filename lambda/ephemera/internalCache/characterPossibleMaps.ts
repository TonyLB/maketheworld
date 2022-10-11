import { splitType } from '@tonylb/mtw-utilities/dist/types';
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
                const { RoomId } = await this._CharacterMeta.get(splitType(characterId)[1])
                const descent = await this._Descent.get(`ROOM#${RoomId}`)
                const descentRoomNode = descent.find(({ EphemeraId }) => (EphemeraId = `ROOM#${RoomId}`))
                return {
                    EphemeraId: characterId,
                    //
                    // TODO: Limit possible maps by assets available to the character (global and personal ... later story)
                    //
                    mapsPossible: (descentRoomNode?.connections || []).map(({ EphemeraId }) => (EphemeraId)).filter(isEphemeraMapId)
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
