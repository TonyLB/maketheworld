import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'
import { CacheGlobal, CacheGlobalData } from '.';

export type PlayerMetaItem = {
    key: string;
    guestName?: string;
    guestId?: string;
}

export class CachePlayerMetaData {
    _getPlayer: () => Promise<string | undefined>;
    PlayerMetaById: Record<string, PlayerMetaItem> = {};

    constructor(globalCache: CacheGlobalData) {
        this._getPlayer = async () => (await globalCache.get('player'))
    }
    clear() {
        this.PlayerMetaById = {}
    }
    async get(player?: string): Promise<PlayerMetaItem | undefined> {
        const confirmedPlayer = player || await this._getPlayer()
        if (!confirmedPlayer) {
            return undefined
        }
        if (!(this.PlayerMetaById[confirmedPlayer])) {
            const playerData = await ephemeraDB.getItem<{ guestId: string; guestName: string }>({
                    EphemeraId: `PLAYER#${confirmedPlayer}`,
                    DataCategory: 'Meta::Player',
                    ProjectionFields: ['guestId', 'guestName']
                })
            if (playerData) {
                this.PlayerMetaById[confirmedPlayer] = {
                    key: confirmedPlayer,
                    ...playerData
                }
            }
        }
        return this.PlayerMetaById[confirmedPlayer]
    }
    set(playerItem: PlayerMetaItem): void {
        this.PlayerMetaById[playerItem.key] = playerItem
    }
}

export const CachePlayerMeta = <GBase extends ReturnType<typeof CacheGlobal>>(Base: GBase) => {
    return class CachePlayerMeta extends Base {
        PlayerMeta: CachePlayerMetaData

        constructor(...rest: any) {
            super(...rest)
            this.PlayerMeta = new CachePlayerMetaData(
                this.Global
            )
        }

        override clear() {
            this.PlayerMeta.clear()
            super.clear()
        }
    }
}

export default CachePlayerMeta
