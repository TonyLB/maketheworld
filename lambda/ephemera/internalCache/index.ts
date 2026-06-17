

import CacheCharacterMetaData from './characterMeta';
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB';

import {
    createComponentDataCacheHandler,
    type ComponentDataCache,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData';
import {
    ComponentAggregateMergedCache,
    createComponentAggregateCacheHandler,
} from '@tonylb/mtw-gateways/ts/assets/components/aggregate';
import {
    ComponentExamplesMergedCache,
    createComponentExamplesCacheHandler,
} from '@tonylb/mtw-gateways/ts/assets/components/componentExamples';
import {
    ComponentTopologyMergedCache,
    createComponentTopologyCacheHandler,
} from '@tonylb/mtw-gateways/ts/assets/components/componentTopology';
import {
    createImportVerticalMetaCacheHandler,
    type ImportVerticalMetaCache,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals';
import {
    createThinkingJobReadCacheHandler,
    createThinkingResultReadCacheHandler,
    createThinkingScheduleReadCacheHandler,
    ThinkingJobReadCache,
    ThinkingResultReadCache,
    ThinkingScheduleReadCache,
} from '@tonylb/mtw-gateways/ts/ephemera/thinking';
import {
    createPositionsCacheHandler,
    type PositionsCacheHandler,
} from '@tonylb/mtw-gateways/ts/ephemera/positions';
import {
    createImprovisationComponentDataCacheHandler,
    type ImprovisationComponentDataCache,
} from '@tonylb/mtw-gateways/ts/ephemera/improvisation';
import ComponentEphemeraMetaData from './componentEphemeraMeta';
import ObjectEphemeraMetaData from './objectEphemeraMeta';
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
import AffordanceRoomDeliverableData from './affordanceRoomDeliverable';
import CachePlayerMetaData from './playerMeta';
import CacheGlobalData from './global';
import { RenderCacheData } from './renderCache';
import { AffordanceCacheData } from './affordanceCache';
import ConversationsData from './conversations';
import PerceptionThreadsData from './perceptionThreads';
import CacheCoyoteGameData from './coyoteGame';
import type { MessageBus } from '../messageBus/baseClasses';
import GenerationContextData from './generationContext';

/** Deferred requires break internalCache <-> messageBus init cycle (FetchPlayerEphemera subscribe). */
const getMessageBus = (): MessageBus => require('../messageBus').default as MessageBus

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
    Conversations: ConversationsData = new ConversationsData(this.Global)
    RenderCache: RenderCacheData = new RenderCacheData()
    AffordanceCache: AffordanceCacheData = new AffordanceCacheData()
    Positions: PositionsCacheHandler = createPositionsCacheHandler(ephemeraDB)
    PlayerMeta: CachePlayerMetaData;
    OrchestrateMessages: OrchestrateMessagesData = new OrchestrateMessagesData()
    PerceptionThreads: PerceptionThreadsData = new PerceptionThreadsData()
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
    
    ComponentData: ComponentDataCache = createComponentDataCacheHandler(assetDB);
    ComponentVerticals: ImportVerticalMetaCache = createImportVerticalMetaCacheHandler(assetDB);
    ComponentAggregate: ComponentAggregateMergedCache;
    ComponentExamples: ComponentExamplesMergedCache;
    ComponentTopology: ComponentTopologyMergedCache;
    ThinkingResults: ThinkingResultReadCache = createThinkingResultReadCacheHandler(ephemeraDB);
    ThinkingSchedules: ThinkingScheduleReadCache = createThinkingScheduleReadCacheHandler(ephemeraDB);
    ThinkingJobs: ThinkingJobReadCache = createThinkingJobReadCacheHandler(ephemeraDB);
    ComponentEphemeraMeta: ComponentEphemeraMetaData = new ComponentEphemeraMetaData();
    ObjectEphemeraMeta: ObjectEphemeraMetaData = new ObjectEphemeraMetaData();
    ImprovisationComponentData: ImprovisationComponentDataCache = createImprovisationComponentDataCacheHandler(ephemeraDB);
    AssetMetaData: AssetMetaData = new AssetMetaData();

    _invalidateAssetCallback: (EphemeraId: string) => void;
    
    AffordanceRoomDeliverable: AffordanceRoomDeliverableData;
    GenerationContext: GenerationContextData;

    constructor() {
        this.CoyoteGame = new CacheCoyoteGameData({
            generateIntent: () => {
                const { generateHypothesis } = require('../dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis') as typeof import('../dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis')
                return generateHypothesis({
                    getGameRooms: () => this.CoyoteGame.get('gameRooms'),
                    getRoomMeta: (roomId) => this.ComponentEphemeraMeta.get(roomId),
                    messageBus: getMessageBus(),
                })
            },
            // Outcome reuses the same `CoyoteGame.get('intent')` record (intent, walkthrough, phasePlan) as hypothesis; no second intent fetch.
            generateOutcome: () => {
                const { generatePlanOutcome } = require('../dataSource/coyoteGame/generators/pipelines/outcome/generatePlanOutcome') as typeof import('../dataSource/coyoteGame/generators/pipelines/outcome/generatePlanOutcome')
                return generatePlanOutcome({
                    getGameRooms: () => this.CoyoteGame.get('gameRooms'),
                    getRoomMeta: (roomId) => this.ComponentEphemeraMeta.get(roomId),
                    getIntentRecord: () => this.CoyoteGame.get('intent'),
                })
            },
        })
        this.PlayerMeta = new CachePlayerMetaData(this.Global)
        this._graphCache = new (GraphCache(graphDBHandler)(GraphEdge(graphDBHandler)(GraphNode(graphDBHandler)(GraphCacheBase))))()
        this.Graph = this._graphCache.Graph
        this.GraphNodes = this._graphCache.Nodes
        this.GraphEdges = this._graphCache.Edges
        // AssetMap removed - was used for Variable/Computed dependency resolution
        this.ComponentAggregate = createComponentAggregateCacheHandler({
            ComponentData: this.ComponentData,
            ComponentVerticals: this.ComponentVerticals,
        })
        this.ComponentExamples = createComponentExamplesCacheHandler({
            ComponentAggregate: this.ComponentAggregate,
        })
        this.ComponentTopology = createComponentTopologyCacheHandler({
            ComponentAggregate: this.ComponentAggregate,
        })
        this.AffordanceRoomDeliverable = new AffordanceRoomDeliverableData(
            this.ComponentAggregate,
            this.AffordanceCache,
            (roomId) => this.ComponentEphemeraMeta.get(roomId)
        )
        this.GenerationContext = new GenerationContextData(this.ComponentData)
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
        this.CharacterMeta.clear()
        this.AssetRooms.clear()
        this.RoomAssets.clear()
        this.SessionConnections.clear()
        this.CharacterSessions.clear()
        this.PlayerSessions.clear()
        this._graphCache.clear()
        this.ComponentData.clear()
        this.ComponentVerticals.clear()
        this.ComponentTopology.clear()
        this.ComponentExamples.clear()
        this.ComponentAggregate.clear()
        this.ThinkingResults.clear()
        this.ThinkingSchedules.clear()
        this.ThinkingJobs.clear()
        this.ComponentEphemeraMeta.clear()
        this.ObjectEphemeraMeta.clear()
        this.ImprovisationComponentData.clear()
        this.AssetMetaData.clear()

        this.AffordanceRoomDeliverable.clear()
        this.GenerationContext.clear()
        this.Conversations.clear()
        this.RenderCache.clear()
        this.AffordanceCache.clear()
        this.Positions.clear()
    }

    async flush() {
        await Promise.all([
            this._graphCache.flush(),
            this.ComponentData.flush(),
            this.ImprovisationComponentData.flush(),
            this.ComponentVerticals.flush(),
            this.ComponentTopology.flush(),
            this.ComponentExamples.flush(),
            this.ComponentAggregate.flush(),
            this.ThinkingResults.flush(),
            this.ThinkingSchedules.flush(),
            this.ThinkingJobs.flush(),
            this.AssetMetaData.flush(),
            this.AffordanceRoomDeliverable.flush(),
            this.GenerationContext.flush(),
            this.RenderCache.flush(),
            this.AffordanceCache.flush(),
            this.Positions.flush(),
        ])
    }

}

// Default instance
export let internalCache: InternalCache = new InternalCache()

export default internalCache
