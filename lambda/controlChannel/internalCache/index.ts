import { CacheConstructor, CacheBase } from './baseClasses'

import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'
import CacheRoomCharacterLists from './roomCharacterLists';
import CacheCharacterMeta from './characterMeta';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB';

type CacheGlobalKeys = 'ConnectionId' | 'RequestId' | 'player' | 'assets'
class CacheGlobalData {
    ConnectionId?: string;
    RequestId?: string;
    player?: string;
    assets?: string[];
    get(key: 'ConnectionId' | 'RequestId' | 'player'): Promise<string | undefined>
    get(key: 'assets'): Promise<string[] | undefined>
    get(key: CacheGlobalKeys): Promise<string | string[] | undefined>
    async get(key: CacheGlobalKeys) {
        switch(key) {
            case 'player':
                if (!this.player && this.ConnectionId) {
                    //
                    // TODO: Replace repeated attempts with exponential backoff by
                    // refactoring connectionDB.getItem to allow a consistent argument
                    // that can actviate strongly-consistent reads
                    //
                    let attempts = 0
                    let exponentialBackoff = 50
                    while(attempts < 5) {
                        const { player = '' } = await connectionDB.getItem<{ player: string }>({
                            ConnectionId: this.ConnectionId,
                            DataCategory: 'Meta::Connection',
                            ProjectionFields: ['player']
                        }) || {}
                        if (player) {
                            this.player = player
                            return player
                        }
                        attempts += 1
                        await delayPromise(exponentialBackoff)
                        exponentialBackoff = exponentialBackoff * 2
                    }
                }
                return this.player
            case 'assets':
                if (this.assets !== undefined) {
                    const { assets = [] } = (await ephemeraDB.getItem<{ assets: string[] }>({
                        EphemeraId: 'Global',
                        DataCategory: 'Assets',
                        ProjectionFields: ['assets']
                    })) || {}
                }
                return this.assets
            default:
                return this[key]
        }
    }

    clear() {
        this.ConnectionId = undefined
        this.RequestId = undefined
        this.player = undefined
        this.assets = undefined
    }

    set(props: { key: 'ConnectionId' | 'RequestId', value: string; }): void {
        this[props.key] = props.value
    }
}

export const CacheGlobal = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheGlobal extends Base {
        Global: CacheGlobalData = new CacheGlobalData()

        override clear() {
            this.Global.clear()
            super.clear()
        }
    }
}

const InternalCache = CacheCharacterMeta(CacheRoomCharacterLists(CacheGlobal(CacheBase)))
export const internalCache = new InternalCache()
export default internalCache
