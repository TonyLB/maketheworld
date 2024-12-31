import { isStateItemId } from './baseClasses'

import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'
import CacheRoomCharacterListsData from './roomCharacterLists';
import CacheCharacterMetaData from './characterMeta';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB';
import { AssetMap, AssetStateData, EvaluateCodeData, StateData } from './assetState';
import ComponentMetaData from './componentMeta';
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import CacheAssetMetaData from './assetMeta';
import { CacheAssetRoomsData, CacheRoomAssetsData } from './assetRooms';
import { GraphCacheType, GraphEdgeType, GraphNodeType } from './graph';
import OrchestrateMessagesData from './orchestrateMessages';
import CacheAssetAddressData from './assetAddress';
import CacheCharacterSessionsData from './characterSessions';
import CacheSessionConnectionsData from './sessionConnections';
import CachePlayerSessionsData from './playerSessions';
import GraphCache from '@tonylb/mtw-utilities/ts/graphStorage/cache';
import GraphNode from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphNode"
import GraphEdge from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphEdge"
import { CacheBase as GraphCacheBase, GraphDBHandler } from '@tonylb/mtw-utilities/ts/graphStorage/cache/baseClasses';
import withPrimitives from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/primitives';
import withGetOperations from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/get';
import { DBHandlerBase } from '@tonylb/mtw-utilities/ts/dynamoDB/baseClasses';
import ExamplesData from './examples';
import ComponentRenderData from './componentRender';
import CacheCharacterPossibleMapsData from './characterPossibleMaps';
import CachePlayerMetaData from './playerMeta';


type CacheGlobalKeys = 'ConnectionId' | 'SessionId' | 'RequestId' | 'player' | 'assets' | 'sessions' | 'mapSubscriptions'

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
                    const { connections = {} } = (await connectionDB.getItem<{ connections: Record<string, string> }>({
                        Key: {
                            ConnectionId: 'Global',
                            DataCategory: 'Sessions'    
                        },
                        ProjectionFields: ['sessions']
                    })) || {}
                    this.sessions = Object.keys(connections)
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

const graphDBHandler: GraphDBHandler = new (withPrimitives<'PrimaryKey', string>()(withGetOperations<'PrimaryKey', string>()(DBHandlerBase)))({
    client: ephemeraDB._client,
    tableName: ephemeraDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'EphemeraId',
    options: { getBatchSize: 50 }
})

export class InternalCache {
    Global: CacheGlobalData = new CacheGlobalData()
    PlayerMeta: CachePlayerMetaData;
    AssetAddress: CacheAssetAddressData = new CacheAssetAddressData()
    OrchestrateMessages: OrchestrateMessagesData = new OrchestrateMessagesData()
    RoomCharacterList: CacheRoomCharacterListsData = new CacheRoomCharacterListsData()
    CharacterMeta: CacheCharacterMetaData = new CacheCharacterMetaData()
    AssetMeta: CacheAssetMetaData = new CacheAssetMetaData()
    AssetRooms: CacheAssetRoomsData = new CacheAssetRoomsData()
    RoomAssets: CacheRoomAssetsData = new CacheRoomAssetsData()
    SessionConnections: CacheSessionConnectionsData = new CacheSessionConnectionsData()
    CharacterSessions: CacheCharacterSessionsData = new CacheCharacterSessionsData()
    PlayerSessions: CachePlayerSessionsData = new CachePlayerSessionsData()

    _graphCache: InstanceType<ReturnType<ReturnType<typeof GraphCache>>>
    Graph: GraphCacheType;
    GraphNodes: GraphNodeType;
    GraphEdges: GraphEdgeType;
    
    ComponentMeta: ComponentMetaData = new ComponentMetaData();

    _invalidateAssetCallback: (EphemeraId: string) => void;
    StateCache: StateData = new StateData((EphemeraId) => { this._invalidateAssetCallback(EphemeraId) })
    AssetState: AssetStateData = new AssetStateData(this.StateCache)
    EvaluateCode: EvaluateCodeData = new EvaluateCodeData(this.AssetState)
    AssetMap: AssetMap
    
    Examples: ExamplesData = new ExamplesData()

    ComponentRender: ComponentRenderData;    
    CharacterPossibleMaps: CacheCharacterPossibleMapsData;    

    constructor() {
        this.PlayerMeta = new CachePlayerMetaData(this.Global)
        this._graphCache = new (GraphCache(graphDBHandler)(GraphEdge(graphDBHandler)(GraphNode(graphDBHandler)(GraphCacheBase))))()
        this.Graph = this._graphCache.Graph
        this.GraphNodes = this._graphCache.Nodes
        this.GraphEdges = this._graphCache.Edges
        this.AssetMap = new AssetMap(this.GraphNodes, this.GraphEdges)
        this.ComponentRender = new ComponentRenderData(
            this.Examples,
            this.EvaluateCode,
            this.ComponentMeta,
            this.RoomCharacterList,
            this.Global,
            this.CharacterMeta
        )
        this.CharacterPossibleMaps = new CacheCharacterPossibleMapsData(this.CharacterMeta, this.Graph)
        this._invalidateAssetCallback = (EphemeraId) => {
            if (isStateItemId(EphemeraId)) {
                this.EvaluateCode.invalidateByAssetStateId(EphemeraId)
                this.ComponentRender.invalidateByEphemeraId(EphemeraId)
            }
        }
    }

    clear() {
        this.Global.clear()
        this.PlayerMeta.clear()
        this.AssetAddress.clear()
        this.OrchestrateMessages.clear()
        this.RoomCharacterList.clear()
        this.CharacterMeta.clear()
        this.AssetMeta.clear()
        this.AssetRooms.clear()
        this.RoomAssets.clear()
        this.SessionConnections.clear()
        this.CharacterSessions.clear()
        this.PlayerSessions.clear()
        this._graphCache.clear()
        this.ComponentMeta.clear()
        this.StateCache.clear()
        this.EvaluateCode.clear()
        this.Examples.clear()
        this.ComponentRender.clear()
        this.CharacterPossibleMaps.clear()
    }

    async flush() {
        await Promise.all([
            this._graphCache.flush(),
            this.ComponentMeta.flush(),
            this.StateCache.flush(),
            this.ComponentRender.flush(),
        ])
    }

}

export const internalCache = new InternalCache()
export default internalCache
