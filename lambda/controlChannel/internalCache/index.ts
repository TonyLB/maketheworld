import { CacheConstructor, CacheBase } from './baseClasses'

import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'
import CacheRoomCharacterLists from './roomCharacterLists';
import CacheCharacterMeta from './characterMeta';

type CacheGlobalKeys = 'ConnectionId' | 'RequestId' | 'player'
class CacheGlobalData {
    ConnectionId?: string;
    RequestId?: string;
    player?: string;
    get(key: 'ConnectionId' | 'RequestId' | 'player'): Promise<string | undefined>
    get(key: CacheGlobalKeys): Promise<string | undefined>
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
            default:
                return this[key]
        }
    }

    clear() {
        this.ConnectionId = undefined
        this.RequestId = undefined
        this.player = undefined
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
