import { S3Client } from "@aws-sdk/client-s3"
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

type CacheConnectionKeys = 's3Client' | 'connectionId' | 'RequestId' | 'player' | 'sessionId'
class CacheConnectionData {
    connectionId?: string;
    sessionId?: string;
    RequestId?: string;
    s3Client?: S3Client;
    player?: string;
    get(key: 'connectionId' | 'RequestId' | 'player' | 'sessionId'): Promise<string | undefined>
    get(key: 's3Client'): Promise<S3Client | undefined>
    get(key: CacheConnectionKeys): Promise<S3Client | string | undefined>
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
                }
                return this[key]
            default:
                return this[key]
        }
    }
    
    set(props: { key: 's3Client', value: S3Client; }): void
    set(props: { key: 'connectionId' | 'RequestId' | 'player' | 'sessionId', value: string; }): void
    set({ key, value }: { key: CacheConnectionKeys, value: any }): void {
        this[key] = value
    }
    
    clear() {
        this.s3Client = undefined
        this.connectionId = undefined
        this.RequestId = undefined
        this.player = undefined
        this.sessionId = undefined
    }
}

class InternalCache {
    Connection: CacheConnectionData = new CacheConnectionData()
    
    constructor() {
    }

    clear(): void {
        this.Connection.clear()
    }

    async flush(): Promise<void> {
    }
}
export const internalCache = new InternalCache()
export default internalCache
