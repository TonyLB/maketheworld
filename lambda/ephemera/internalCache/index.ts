

import CacheRoomCharacterListsData from './roomCharacterLists';
import CacheCharacterMetaData from './characterMeta';
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB';

import ComponentAssetMetaData from './componentAssetMeta';
import ComponentEphemeraMetaData from './componentEphemeraMeta';
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
import ComponentStackMergeData from './componentStackMerge';
import { queryCacheRecordsForComponent } from '../dataSource/renderCache/queryCacheRecordsForComponent';
import CacheCharacterPossibleMapsData from './characterPossibleMaps';
import CachePlayerMetaData from './playerMeta';
import CacheGlobalData from './global';
import { RenderCacheData } from './renderCache';
import ConversationsData from './conversations';
import PerceptionThreadsData from './perceptionThreads';
import messageBus from '../messageBus';
import CacheCoyoteGameData from './coyoteGame';
import { generateHypothesis } from '../dataSource/coyoteGame/generateHypothesis';
import { generatePlanOutcome } from '../dataSource/coyoteGame/generatePlanOutcome';
import GenerationContextData from './generationContext';

const graphDBHandler: GraphDBHandler = new (withPrimitives<'PrimaryKey', string>()(withGetOperations<'PrimaryKey', string>()(DBHandlerBase)))({
    client: assetDB._client,
    tableName: assetDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'AssetId',
    options: { getBatchSize: 50 }
})

export class InternalCache {
    Global: CacheGlobalData = new CacheGlobalData()
    CoyoteGame: CacheCoyoteGameData;
    Conversations: ConversationsData = new ConversationsData(this.Global, messageBus)
    RenderCache: RenderCacheData = new RenderCacheData(queryCacheRecordsForComponent)
    PlayerMeta: CachePlayerMetaData;
    OrchestrateMessages: OrchestrateMessagesData = new OrchestrateMessagesData()
    PerceptionThreads: PerceptionThreadsData = new PerceptionThreadsData()
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
    ComponentEphemeraMeta: ComponentEphemeraMetaData = new ComponentEphemeraMetaData();
    AssetMetaData: AssetMetaData = new AssetMetaData();

    _invalidateAssetCallback: (EphemeraId: string) => void;
    
    Examples: ExamplesData = new ExamplesData()

    ComponentRender: ComponentRenderData;
    ComponentStackMerge: ComponentStackMergeData;
    GenerationContext: GenerationContextData;
    CharacterPossibleMaps: CacheCharacterPossibleMapsData;

    constructor() {
        this.CoyoteGame = new CacheCoyoteGameData({
            generateIntent: () => generateHypothesis({
                getGameRooms: () => this.CoyoteGame.get('gameRooms'),
                getRoomMeta: (roomId) => this.ComponentEphemeraMeta.get(roomId),
            }),
            // Outcome reuses the same `CoyoteGame.get('intent')` record (intent, walkthrough, phasePlan) as hypothesis; no second intent fetch.
            generateOutcome: () => generatePlanOutcome({
                getGameRooms: () => this.CoyoteGame.get('gameRooms'),
                getRoomMeta: (roomId) => this.ComponentEphemeraMeta.get(roomId),
                getIntentRecord: () => this.CoyoteGame.get('intent'),
            }),
        })
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
        this.ComponentStackMerge = new ComponentStackMergeData(
            this.ComponentAssetMeta,
            this.RoomCharacterList,
            this.Global,
            this.CharacterMeta,
            (roomId) => this.ComponentEphemeraMeta.get(roomId)
        )
        this.GenerationContext = new GenerationContextData(this.ComponentAssetMeta)
        this.CharacterPossibleMaps = new CacheCharacterPossibleMapsData(this.CharacterMeta, this.Graph)
        this._invalidateAssetCallback = (EphemeraId) => {
            // Variable/Computed invalidation removed - no longer needed
        }
    }

    clear() {
        this.Global.clear()
        this.CoyoteGame.clear()
        this.PlayerMeta.clear()
        this.OrchestrateMessages.clear()
        this.PerceptionThreads.clear()
        this.RoomCharacterList.clear()
        this.CharacterMeta.clear()
        this.AssetRooms.clear()
        this.RoomAssets.clear()
        this.SessionConnections.clear()
        this.CharacterSessions.clear()
        this.PlayerSessions.clear()
        this._graphCache.clear()
        this.ComponentAssetMeta.clear()
        this.ComponentEphemeraMeta.clear()
        this.AssetMetaData.clear()

        this.Examples.clear()
        this.ComponentRender.clear()
        this.ComponentStackMerge.clear()
        this.GenerationContext.clear()
        this.CharacterPossibleMaps.clear()
        this.Conversations.clear()
        this.RenderCache.clear()
    }

    async flush() {
        await Promise.all([
            this._graphCache.flush(),
            this.ComponentAssetMeta.flush(),
            this.AssetMetaData.flush(),
            this.ComponentRender.flush(),
            this.ComponentStackMerge.flush(),
            this.GenerationContext.flush(),
            this.RenderCache.flush(),
        ])
    }

}

// Default instance
export let internalCache: InternalCache = new InternalCache()

export default internalCache
