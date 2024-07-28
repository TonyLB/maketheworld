import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { CacheConstructor, CacheBase } from './baseClasses'
import CacheLibrary from './library'
import { S3Client } from "@aws-sdk/client-s3"
import CachePlayerLibrary from './playerLibrary'
import Meta from './meta'
import CachePlayerSettings from './playerSettings'
import CacheGraph from './graph'
import CacheSessionConnections from './sessionConnections'
import CachePlayerSessions from './playerSessions'

type CacheConnectionKeys = 'connectionId' | 'sessionId' | 'RequestId' | 'player' | 's3Client' | 'librarySubscriptions'
class CacheConnectionData {
    connectionId?: string;
    sessionId?: string;
    RequestId?: string;
    s3Client?: S3Client;
    player?: string;
    librarySubscriptions?: string[];
    get(key: 'connectionId' | 'sessionId' | 'RequestId' | 'player'): Promise<string | undefined>
    get(key: 's3Client'): Promise<S3Client | undefined>
    get(key: 'librarySubscriptions'): Promise<string[] | undefined>
    get(key: CacheConnectionKeys): Promise<S3Client | string | string[] | undefined>
    async get(key: CacheConnectionKeys) {
        switch(key) {
            case 'player':
            case 'sessionId':
                if (this.connectionId && !(this.player && this.sessionId)) {
                    //
                    // First get player with eventually consistent read (almost always going to work),
                    // then fall back, if the player's Connection write has not yet been registered
                    // (as sometimes happens in the first few fetches after logon) to strongly consistent
                    // read to guarantee (as much as possible) the result
                    //
                    const getArguments = {
                        Key: {
                            ConnectionId: `CONNECTION#${this.connectionId}`,
                            DataCategory: 'Meta::Connection'
                        },
                        ProjectionFields: ['player', 'SessionId'],
                    }
                    const { player = '', SessionId: sessionId = '' } = await connectionDB.getItem<{ player: string; SessionId: string; }>(getArguments) || {}
                    if (player && sessionId) {
                        this.player = player
                        this.sessionId = sessionId
                    }
                    else {
                        const { player = '', SessionId: sessionId = '' } = await connectionDB.getItem<{ player: string; SessionId: string; }>({
                            ...getArguments,
                            ConsistentRead: true
                        }) || {}
                        if (player && sessionId) {
                            this.player = player
                            this.sessionId = sessionId
                        }
                    }
                }
                return key === 'player' ? this.player : this.sessionId
            case 'librarySubscriptions':
                if (typeof this.librarySubscriptions === 'undefined') {
                    const { SessionIds = [] } = (await connectionDB.getItem<{ SessionIds: string[] }>({
                        Key: {
                            ConnectionId: 'Library',
                            DataCategory: 'Subscriptions'
                        },
                        ProjectionFields: ['SessionIds']
                    })) || {}
                    this.librarySubscriptions = SessionIds
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

const InternalCache = Meta(CachePlayerSettings(CachePlayerLibrary(CacheLibrary(CachePlayerSessions(CacheSessionConnections(CacheConnection(CacheGraph(CacheBase))))))))
export const internalCache = new InternalCache()
export default internalCache
