import { legacyConnectionDB as connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor, CacheBase } from './baseClasses'
import CacheLibrary from './library'
import { S3Client } from "@aws-sdk/client-s3"
import CachePlayerLibrary from './playerLibrary'
import CacheConnectionsByPlayer from './connectionsByPlayer'
import JSONFile from './jsonFile'
import Meta from './meta'
import CachePlayerSettings from './playerSettings'

type CacheConnectionKeys = 'connectionId' | 'RequestId' | 'player' | 's3Client' | 'librarySubscriptions'
class CacheConnectionData {
    connectionId?: string;
    RequestId?: string;
    s3Client?: S3Client;
    player?: string;
    librarySubscriptions?: string[];
    get(key: 'connectionId' | 'RequestId' | 'player'): Promise<string | undefined>
    get(key: 's3Client'): Promise<S3Client | undefined>
    get(key: 'librarySubscriptions'): Promise<string[] | undefined>
    get(key: CacheConnectionKeys): Promise<S3Client | string | string[] | undefined>
    async get(key: CacheConnectionKeys) {
        switch(key) {
            case 'player':
                if (!this.player && this.connectionId) {
                    //
                    // First get player with eventually consistent read (almost always going to work),
                    // then fall back, if the player's Connection write has not yet been registered
                    // (as sometimes happens in the first few fetches after logon) to strongly consistent
                    // read to guarantee (as much as possible) the result
                    //
                    const getArguments = {
                        ConnectionId: `CONNECTION#${this.connectionId}`,
                        DataCategory: 'Meta::Connection',
                        ProjectionFields: ['player'],
                    }
                    const { player = '' } = await connectionDB.getItem<{ player: string }>(getArguments) || {}
                    if (player) {
                        this.player = player
                    }
                    else {
                        const { player = '' } = await connectionDB.getItem<{ player: string }>({
                            ...getArguments,
                            ConsistentRead: true
                        }) || {}
                        if (player) {
                            this.player = player
                        }
                    }
                }
                return this.player
            case 'librarySubscriptions':
                if (typeof this.librarySubscriptions === 'undefined') {
                    const { ConnectionIds = [] } = (await connectionDB.getItem<{ ConnectionIds: string[] }>({
                        ConnectionId: 'Library',
                        DataCategory: 'Subscriptions',
                        ProjectionFields: ['ConnectionIds']
                    })) || {}
                    this.librarySubscriptions = ConnectionIds
                }
                return this.librarySubscriptions
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

    set(props: { key: 'connectionId' | 'RequestId' | 'player', value: string; }): void
    set(props: { key: 's3Client', value: S3Client; }): void
    set({ key, value }: { key: CacheConnectionKeys, value: any }): void {
        this[key] = value
    }

    invalidate(key: 'librarySubscriptions'): void {
        delete this[key]
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

const InternalCache = JSONFile(Meta(CacheConnectionsByPlayer(CachePlayerSettings(CachePlayerLibrary(CacheLibrary(CacheConnection(CacheBase)))))))
export const internalCache = new InternalCache()
export default internalCache
