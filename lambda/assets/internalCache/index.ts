import {
    ComponentAggregateMergedCache,
    createComponentAggregateCacheHandler,
} from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    createAuthoritativeComponentDataCacheHandler,
    type AuthoritativeComponentDataCache,
} from '@tonylb/mtw-gateways/ts/assets/components/assetMeta'
import {
    createImportVerticalMetaCacheHandler,
    type ImportVerticalMetaCache,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import { assetDB, connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { CacheConstructor } from './baseClasses'
import { S3Client } from "@aws-sdk/client-s3"
import { CachePlayerLibraryData } from './playerLibrary'
import { AssetMetaData } from './assetMeta'
import { CachePlayerSettingData } from './playerSettings'
import { GraphCacheType, graphDBHandler, GraphNodeType } from './graph'
import { CacheSessionConnectionsData } from '@tonylb/mtw-sessions/ts/sessionCache'
import { CachePlayerSessionsData } from './playerSessions'
import { CacheBase as GraphCacheBase } from "@tonylb/mtw-utilities/ts/graphStorage/cache/baseClasses"
import GraphCache from "@tonylb/mtw-utilities/ts/graphStorage/cache"
import GraphNode from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphNode"
import GraphEdge from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphEdge"
import { AssetData } from './assetData'


type CacheConnectionKeys = 'connectionId' | 'sessionId' | 'RequestId' | 'player' | 's3Client'
class CacheConnectionData {
    connectionId?: string;
    sessionId?: string;
    RequestId?: string;
    s3Client?: S3Client;
    player?: string;
    get(key: 'connectionId' | 'sessionId' | 'RequestId' | 'player'): Promise<string | undefined>
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

class InternalCache {
    Connection: CacheConnectionData = new CacheConnectionData()
    AssetMetaData: AssetMetaData = new AssetMetaData()
    AssetData: AssetData = new AssetData()
    ComponentData: AuthoritativeComponentDataCache = createAuthoritativeComponentDataCacheHandler(assetDB)
    ComponentVerticals: ImportVerticalMetaCache = createImportVerticalMetaCacheHandler(assetDB)
    ComponentAggregate: ComponentAggregateMergedCache
    PlayerSettings: CachePlayerSettingData = new CachePlayerSettingData()
    PlayerLibrary: CachePlayerLibraryData = new CachePlayerLibraryData()
    // Note: Legacy Library cache removed - now using mtw.assets.library DataSource
    PlayerSessions: CachePlayerSessionsData = new CachePlayerSessionsData()
    SessionConnections: CacheSessionConnectionsData = new CacheSessionConnectionsData()
    _graphCache: InstanceType<ReturnType<ReturnType<typeof GraphCache>>> = new (GraphCache(graphDBHandler)(GraphEdge(graphDBHandler)(GraphNode(graphDBHandler)(GraphCacheBase))))()
    Graph: GraphCacheType
    GraphNodes: GraphNodeType
    
    constructor() {
        this.Graph = this._graphCache.Graph
        this.GraphNodes = this._graphCache.Nodes
        this.ComponentAggregate = createComponentAggregateCacheHandler({
            ComponentData: this.ComponentData,
            ComponentVerticals: this.ComponentVerticals,
        })
    }

    clear(): void {
        this.Connection.clear()
        this.AssetMetaData.clear()
        this.AssetData.clear()
        this.ComponentData.clear()
        this.ComponentVerticals.clear()
        this.ComponentAggregate.clear()
        this.PlayerSettings.clear()
        this.PlayerLibrary.clear()
        // Note: Legacy Library.clear() removed
        this.PlayerSessions.clear()
        this.SessionConnections.clear()
    }

    async flush(): Promise<void> {
        await Promise.all([
            this._graphCache.flush(),
            this.AssetData.flush(),
            this.ComponentAggregate.flush(),
        ])
    }
}
export const internalCache = new InternalCache()
export default internalCache
