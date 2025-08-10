

import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import { delayPromise } from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'
import CacheRoomCharacterListsData from './roomCharacterLists';
import CacheCharacterMetaData from './characterMeta';
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB';

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
import CacheGlobalData from './global';

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
    
    Examples: ExamplesData = new ExamplesData()

    ComponentRender: ComponentRenderData;    
    CharacterPossibleMaps: CacheCharacterPossibleMapsData;    

    constructor() {
        this.PlayerMeta = new CachePlayerMetaData(this.Global)
        this._graphCache = new (GraphCache(graphDBHandler)(GraphEdge(graphDBHandler)(GraphNode(graphDBHandler)(GraphCacheBase))))()
        this.Graph = this._graphCache.Graph
        this.GraphNodes = this._graphCache.Nodes
        this.GraphEdges = this._graphCache.Edges
        // AssetMap removed - was used for Variable/Computed dependency resolution
        this.ComponentRender = new ComponentRenderData(
            this.Examples,
            this.ComponentMeta,
            this.RoomCharacterList,
            this.Global,
            this.CharacterMeta
        )
        this.CharacterPossibleMaps = new CacheCharacterPossibleMapsData(this.CharacterMeta, this.Graph)
        this._invalidateAssetCallback = (EphemeraId) => {
            // Variable/Computed invalidation removed - no longer needed
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

        this.Examples.clear()
        this.ComponentRender.clear()
        this.CharacterPossibleMaps.clear()
    }

    async flush() {
        await Promise.all([
            this._graphCache.flush(),
            this.ComponentMeta.flush(),

            this.ComponentRender.flush(),
        ])
    }

}

// Default instance
export let internalCache: InternalCache = new InternalCache()

export default internalCache
