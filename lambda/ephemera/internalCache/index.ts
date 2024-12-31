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
