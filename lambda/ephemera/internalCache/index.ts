

import CacheRoomCharacterListsData from './roomCharacterLists';
import CacheCharacterMetaData from './characterMeta';
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB';

import ComponentAssetMetaData from './componentAssetMeta';
import { AssetMetaData } from './assetMeta';
import { CacheAssetRoomsData, CacheRoomAssetsData } from './assetRooms';
import { GraphCacheType, GraphEdgeType, GraphNodeType } from './graph';
import OrchestrateMessagesData from './orchestrateMessages';
import CacheCharacterSessionsData from './characterSessions';
import { CacheSessionConnectionsData } from '@tonylb/mtw-sessions/ts/sessionCache';
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
import { queryCacheRecordsForComponent } from '../dataSource/renderCache/queryCacheRecordsForComponent';
import CacheCharacterPossibleMapsData from './characterPossibleMaps';
import CachePlayerMetaData from './playerMeta';
import CacheGlobalData from './global';
import { PreviewGenerationRequestsData } from './previewGenerationRequests';
import { RenderCacheData } from './renderCache';
import ConversationsData from './conversations';
import messageBus from '../messageBus';

const graphDBHandler: GraphDBHandler = new (withPrimitives<'PrimaryKey', string>()(withGetOperations<'PrimaryKey', string>()(DBHandlerBase)))({
    client: assetDB._client,
    tableName: assetDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'AssetId',
    options: { getBatchSize: 50 }
})

export class InternalCache {
    Global: CacheGlobalData = new CacheGlobalData()
    PreviewGenerationRequests: PreviewGenerationRequestsData = new PreviewGenerationRequestsData()
    Conversations: ConversationsData = new ConversationsData(this.Global, messageBus)
    RenderCache: RenderCacheData = new RenderCacheData(queryCacheRecordsForComponent)
    PlayerMeta: CachePlayerMetaData;
    OrchestrateMessages: OrchestrateMessagesData = new OrchestrateMessagesData()
    RoomCharacterList: CacheRoomCharacterListsData = new CacheRoomCharacterListsData()
    CharacterMeta: CacheCharacterMetaData = new CacheCharacterMetaData()
    AssetRooms: CacheAssetRoomsData = new CacheAssetRoomsData()
    RoomAssets: CacheRoomAssetsData = new CacheRoomAssetsData()
    SessionConnections: CacheSessionConnectionsData = new CacheSessionConnectionsData()
    CharacterSessions: CacheCharacterSessionsData = new CacheCharacterSessionsData()
    PlayerSessions: CachePlayerSessionsData = new CachePlayerSessionsData()

    _graphCache: InstanceType<ReturnType<ReturnType<typeof GraphCache>>>
    Graph: GraphCacheType;
    GraphNodes: GraphNodeType;
    GraphEdges: GraphEdgeType;
    
    ComponentAssetMeta: ComponentAssetMetaData = new ComponentAssetMetaData();
    AssetMetaData: AssetMetaData = new AssetMetaData();

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
            this.ComponentAssetMeta,
            this.RoomCharacterList,
            this.Global,
            this.CharacterMeta,
            this.RenderCache
        )
        this.CharacterPossibleMaps = new CacheCharacterPossibleMapsData(this.CharacterMeta, this.Graph)
        this._invalidateAssetCallback = (EphemeraId) => {
            // Variable/Computed invalidation removed - no longer needed
        }
    }

    clear() {
        this.Global.clear()
        this.PlayerMeta.clear()
        this.OrchestrateMessages.clear()
        this.RoomCharacterList.clear()
        this.CharacterMeta.clear()
        this.AssetRooms.clear()
        this.RoomAssets.clear()
        this.SessionConnections.clear()
        this.CharacterSessions.clear()
        this.PlayerSessions.clear()
        this._graphCache.clear()
        this.ComponentAssetMeta.clear()
        this.AssetMetaData.clear()

        this.Examples.clear()
        this.ComponentRender.clear()
        this.CharacterPossibleMaps.clear()
        this.PreviewGenerationRequests.clear()
        this.Conversations.clear()
        this.RenderCache.clear()
    }

    async flush() {
        await Promise.all([
            this._graphCache.flush(),
            this.ComponentAssetMeta.flush(),
            this.AssetMetaData.flush(),
            this.ComponentRender.flush(),
        ])
    }

}

// Default instance
export let internalCache: InternalCache = new InternalCache()

export default internalCache
