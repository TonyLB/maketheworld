import { connectionDB, ephemeraDB, META_SESSION_PK, sessionIdFromMetaSortKey } from "@tonylb/mtw-utilities/ts/dynamoDB";
import delayPromise from "@tonylb/mtw-utilities/ts/dynamoDB/delayPromise";

export type CacheGlobalKeys = 'ConnectionId' | 'SessionId' | 'RequestId' | 'player' | 'assets' | 'sessions'

export class CacheGlobalData {
    ConnectionId?: string;
    RequestId?: string;
    player?: string;
    SessionId?: string;
    assets?: string[];
    sessions?: string[];
    get(key: 'ConnectionId' | 'RequestId' | 'player' | 'SessionId'): Promise<string | undefined>
    get(key: 'assets' | 'sessions'): Promise<string[] | undefined>
    get(key: CacheGlobalKeys): Promise<string | string[] | undefined>
    async get(key: CacheGlobalKeys) {
        switch(key) {
            case 'player':
            case 'SessionId':
                if (this.ConnectionId && !(this.player && this.SessionId)) {
                    //
                    // TODO: Replace repeated attempts with exponential backoff by
                    // refactoring connectionDB.getItem to allow a consistent argument
                    // that can actviate strongly-consistent reads
                    //
                    let attempts = 0
                    let exponentialBackoff = 50
                    while(attempts < 5) {
                        const { player = '', SessionId = '' } = await connectionDB.getItem<{ player: string; SessionId: string; }>({
                            Key: {
                                ConnectionId: `CONNECTION#${this.ConnectionId}`,
                                DataCategory: 'Meta::Connection'
                            },
                            ProjectionFields: ['player', 'SessionId']
                        }) || {}
                        if (player && SessionId) {
                            this.player = player
                            this.SessionId = SessionId
                            return key === 'player' ? player : SessionId
                        }
                        attempts += 1
                        await delayPromise(exponentialBackoff)
                        exponentialBackoff = exponentialBackoff * 2
                    }
                    console.log(`Exponential backoff on player/session caching failed after five attempts (${this.ConnectionId})`)
                }
                return key === 'player' ? this.player : this.SessionId
            case 'assets':
                if (typeof this.assets === 'undefined') {
                    const { assets = [] } = (await ephemeraDB.getItem<{ assets: string[] }>({
                        Key: {
                            EphemeraId: 'Global',
                            DataCategory: 'Assets'
                        },
                        ProjectionFields: ['assets']
                    })) || {}
                    this.assets = assets
                }
                return this.assets
            case 'sessions':
                if (typeof this.sessions === 'undefined') {
                    const sessions = await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
                        Key: {
                            ConnectionId: META_SESSION_PK
                        },
                        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
                        ExpressionAttributeValues: {
                            ':prefix': 'SESSION#'
                        },
                        ProjectionFields: ['DataCategory'],
                        ConsistentRead: true
                    })
                    this.sessions = (sessions || [])
                        .map(({ DataCategory }) => sessionIdFromMetaSortKey(DataCategory))
                        .filter((sessionId): sessionId is string => (Boolean(sessionId)))
                }
                return this.sessions
            default:
                return this[key]
        }
    }

    clear() {
        this.ConnectionId = undefined
        this.RequestId = undefined
        this.player = undefined
        this.assets = undefined
        this.sessions = undefined
    }

    set(props: { key: 'ConnectionId' | 'RequestId', value: string; }): void
    set(props: { key: 'assets', value: string[] }): void
    set(props: { key: 'ConnectionId' | 'RequestId' | 'assets', value: string |  string[]; }): void {
        const isAssetsEntry = (props: { key: 'ConnectionId' | 'RequestId' | 'assets', value: string | string[]; }): props is { key: 'assets', value: string[] } => (props.key === 'assets')
        const isPlainStringEntry = (props: { key: 'ConnectionId' | 'RequestId' | 'assets', value: string | string[]; }): props is { key: 'ConnectionId' | 'RequestId', value: string } => (props.key !== 'assets')
        if (isAssetsEntry(props)) {
            this.assets = props.value
        }
        if (isPlainStringEntry(props)) {
            this[props.key] = props.value
        }
    }
}

export default CacheGlobalData