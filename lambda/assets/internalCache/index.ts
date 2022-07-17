import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'
import { CacheConstructor, CacheBase } from './baseClasses'
import CacheLibrary from './library'

type CacheConnectionKeys = 'connectionId' | 'RequestId' | 'player'
class CacheConnectionData {
    connectionId?: string;
    RequestId?: string;
    player?: string;
    async get(key: CacheConnectionKeys) {
        switch(key) {
            case 'connectionId':
                return this.connectionId
            case 'RequestId':
                return this.RequestId
            case 'player':
                if (!this.player && this.connectionId) {
                    //
                    // TODO: Replace repeated attempts with exponential backoff by
                    // refactoring connectionDB.getItem to allow a consistent argument
                    // that can actviate strongly-consistent reads
                    //
                    let attempts = 0
                    let exponentialBackoff = 50
                    while(attempts < 5) {
                        const { player = '' } = await connectionDB.getItem<{ player: string }>({
                            ConnectionId: this.connectionId,
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
                return undefined
        }
    }

    clear() {
        this.connectionId = undefined
        this.RequestId = undefined
        this.player = undefined
    }

    set({ key, value }: { key: CacheConnectionKeys, value: string }): void {
        this[key] = value
    }
}

export const CacheConnection = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheConnection extends Base {
        Connection: CacheConnectionData = new CacheConnectionData()

        override clear() {
            this.Connection.clear()
            super.clear()
        }
    }
}

const InternalCache = CacheLibrary(CacheConnection(CacheBase))
export const internalCache = new InternalCache()
export default internalCache
