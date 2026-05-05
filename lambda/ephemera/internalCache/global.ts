import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses";
import { connectionDB, ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import delayPromise from "@tonylb/mtw-utilities/ts/dynamoDB/delayPromise";

export type CacheGlobalKeys = 'ConnectionId' | 'SessionId' | 'RequestId' | 'player' | 'assets' | 'sessions' | 'mapSubscriptions'

export type MapSubscriptionConnection = {
    sessionId: string;
    characterIds: EphemeraCharacterId[]
}

export class CacheGlobalData {
    ConnectionId?: string;
    RequestId?: string;
    player?: string;
    SessionId?: string;
    assets?: string[];
    sessions?: string[];
    mapSubscriptions?: MapSubscriptionConnection[];
    get(key: 'ConnectionId' | 'RequestId' | 'player' | 'SessionId'): Promise<string | undefined>
    get(key: 'assets' | 'sessions'): Promise<string[] | undefined>
    get(key: 'mapSubscriptions'): Promise<MapSubscriptionConnection[] | undefined>
    get(key: CacheGlobalKeys): Promise<string | string[] | MapSubscriptionConnection[] | undefined>
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
                        IndexName: 'DataCategoryIndex',
                        Key: {
                            DataCategory: 'Meta::Session'
                        },
                        ProjectionFields: ['ConnectionId']
                    })
                    this.sessions = (sessions || [])
                        .map(({ ConnectionId }) => (ConnectionId.startsWith('SESSION#') ? ConnectionId.slice(8) : undefined))
                        .filter((sessionId): sessionId is string => (Boolean(sessionId)))
                }
                return this.sessions
            case 'mapSubscriptions':
                if (typeof this.mapSubscriptions === 'undefined') {
                    const { sessions = [] } = (await connectionDB.getItem<{ sessions: MapSubscriptionConnection[] }>({
                        Key: {
                            ConnectionId: 'Map',
                            DataCategory: 'Subscriptions'
                        },
                        ProjectionFields: ['sessions']
                    })) || {}
                    this.mapSubscriptions = sessions
                }
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
        this.mapSubscriptions = undefined
    }

    invalidate(key: 'mapSubscriptions'): void {
        this[key] = undefined
    }

    set(props: { key: 'ConnectionId' | 'RequestId', value: string; }): void
    set(props: { key: 'mapSubscriptions', value: MapSubscriptionConnection[] }): void
    set(props: { key: 'assets', value: string[] }): void
    set(props: { key: 'ConnectionId' | 'RequestId' | 'mapSubscriptions' | 'assets', value: string |  string[] | MapSubscriptionConnection[]; }): void {
        const isMapSubscriptionEntry = (props: { key: 'ConnectionId' | 'RequestId' | 'mapSubscriptions' | 'assets', value: string | string[] | MapSubscriptionConnection[]; }): props is { key: 'mapSubscriptions', value: MapSubscriptionConnection[] } => (props.key === 'mapSubscriptions')
        const isAssetsEntry = (props: { key: 'ConnectionId' | 'RequestId' | 'mapSubscriptions' | 'assets', value: string | string[] | MapSubscriptionConnection[]; }): props is { key: 'assets', value: string[] } => (props.key === 'assets')
        const isPlainStringEntry = (props: { key: 'ConnectionId' | 'RequestId' | 'mapSubscriptions' | 'assets', value: string | string[] | MapSubscriptionConnection[]; }): props is { key: 'ConnectionId' | 'RequestId', value: string } => (props.key !== 'mapSubscriptions' && props.key !== 'assets')
        if (isMapSubscriptionEntry(props)) {
            this.mapSubscriptions = props.value
        }
        if (isAssetsEntry(props)) {
            this.assets = props.value
        }
        if (isPlainStringEntry(props)) {
            this[props.key] = props.value
        }
    }
}

export default CacheGlobalData