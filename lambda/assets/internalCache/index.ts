import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'
import { CacheConstructor, CacheBase } from './baseClasses'
import CacheLibrary from './library'
import { S3Client } from "@aws-sdk/client-s3"

type CacheConnectionKeys = 'connectionId' | 'RequestId' | 'player' | 's3Client'
class CacheConnectionData {
    connectionId?: string;
    RequestId?: string;
    s3Client?: S3Client;
    player?: string;
    get(key: 'connectionId' | 'RequestId' | 'player'): Promise<string | undefined>
    get(key: 's3Client'): Promise<S3Client | undefined>
    get(key: CacheConnectionKeys): Promise<S3Client | string | undefined>
    async get(key: CacheConnectionKeys) {
        switch(key) {
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
                return this[key]
        }
    }

    clear() {
        this.connectionId = undefined
        this.RequestId = undefined
        this.s3Client = undefined
        this.player = undefined
    }

    set(props: { key: 'connectionId' | 'RequestId', value: string; }): void
    set(props: { key: 's3Client', value: S3Client; }): void
    set({ key, value }: { key: CacheConnectionKeys, value: any }): void {
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
