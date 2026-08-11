
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses';

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
    createEphemeraLudicGraphCacheData,
    EphemeraLudicGraphCacheData,
} from './ludicGraphCache';
import {
    createImprovisationComponentDataCacheHandler,
    type ImprovisationComponentDataCache,
} from '@tonylb/mtw-gateways/ts/ephemera/improvisation';
import {
    createObjectEmbeddingCacheHandler,
    type ObjectEmbeddingCacheHandler,
} from '@tonylb/mtw-gateways/ts/ephemera/objectEmbedding';
import {
    createEphemeraComponentDataCompositeCacheHandler,
    type EphemeraComponentDataCompositeCache,
} from './componentDataComposite';
import ComponentEphemeraMetaData from './componentEphemeraMeta';
import ObjectEphemeraMetaData from './objectEphemeraMeta';
import { AssetMetaData } from './assetMeta';
import { CacheAssetRoomsData, CacheRoomAssetsData } from './assetRooms';
import { GraphCacheType, GraphEdgeType, GraphNodeType } from './graph';
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
    Positions: EphemeraLudicGraphCacheData = createEphemeraLudicGraphCacheData(ephemeraDB)
    PlayerMeta: CachePlayerMetaData;
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
    
    private _assetComponentData: ComponentDataCache = createComponentDataCacheHandler(assetDB);
    ImprovisationComponentData: ImprovisationComponentDataCache = createImprovisationComponentDataCacheHandler(ephemeraDB);
    ObjectEmbedding: ObjectEmbeddingCacheHandler = createObjectEmbeddingCacheHandler(ephemeraDB);
    ComponentData: EphemeraComponentDataCompositeCache = createEphemeraComponentDataCompositeCacheHandler({
        assetComponentData: this._assetComponentData,
        improvisationComponentData: this.ImprovisationComponentData,
    });
    ComponentVerticals: ImportVerticalMetaCache = createImportVerticalMetaCacheHandler(assetDB);
    ComponentAggregate: ComponentAggregateMergedCache;
    ComponentExamples: ComponentExamplesMergedCache;
    ComponentTopology: ComponentTopologyMergedCache;
    ThinkingResults: ThinkingResultReadCache = createThinkingResultReadCacheHandler(ephemeraDB);
    ThinkingSchedules: ThinkingScheduleReadCache = createThinkingScheduleReadCacheHandler(ephemeraDB);
    ThinkingJobs: ThinkingJobReadCache = createThinkingJobReadCacheHandler(ephemeraDB);
    ComponentEphemeraMeta: ComponentEphemeraMetaData = new ComponentEphemeraMetaData();
    ObjectEphemeraMeta: ObjectEphemeraMetaData = new ObjectEphemeraMetaData();
    AssetMetaData: AssetMetaData = new AssetMetaData();

    _invalidateAssetCallback: (EphemeraId: string) => void;
    
    AffordanceRoomDeliverable: AffordanceRoomDeliverableData;
    GenerationContext: GenerationContextData;

    constructor() {
        this.CoyoteGame = new CacheCoyoteGameData({
            generateIntent: () => {
                const { generateHypothesis } = require('../dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis') as typeof import('../dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis')
                const { createDefaultCoyoteRoomObjectSnapshotDeps } = require('../dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot') as typeof import('../dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot')
                return generateHypothesis({
                    ...createDefaultCoyoteRoomObjectSnapshotDeps(),
                    messageBus: getMessageBus(),
                })
            },
            // Outcome reuses the same `CoyoteGame.get('intent')` record (intent, walkthrough, phasePlan) as hypothesis; no second intent fetch.
            generateOutcome: () => {
                const { generatePlanOutcome } = require('../dataSource/coyoteGame/generators/pipelines/outcome/generatePlanOutcome') as typeof import('../dataSource/coyoteGame/generators/pipelines/outcome/generatePlanOutcome')
                const { createDefaultCoyoteRoomObjectSnapshotDeps } = require('../dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot') as typeof import('../dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot')
                return generatePlanOutcome({
                    ...createDefaultCoyoteRoomObjectSnapshotDeps(),
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
            (roomId) => this.ComponentEphemeraMeta.get(roomId),
            {
                getLudicGraph: (roomId) => this.Positions.getLudicGraph(roomId),
                getImprovisationObject: (objectId) => this.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
            }
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
        this.ObjectEmbedding.clear()
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
            this.ObjectEmbedding.flush(),
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
