import { CacheBase as GraphCacheBase, GraphDBHandler } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import GraphCache from "@tonylb/mtw-utilities/dist/graphStorage/cache"
import GraphNode from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphNode"
import GraphEdge from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphEdge"
import { CacheConstructor } from "./baseClasses"
import withGetOperations from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/get"
import { DBHandlerBase } from "@tonylb/mtw-utilities/dist/dynamoDB/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import withPrimitives from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/primitives"

export const graphDBHandler: GraphDBHandler = new (withPrimitives<'PrimaryKey', string>()(withGetOperations<'PrimaryKey', string>()(DBHandlerBase)))({
    client: assetDB._client,
    tableName: assetDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'AssetId',
    options: { getBatchSize: 50 }
})

export type GraphCacheType = InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Graph"]
export type GraphNodeType = InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Nodes"]

export const CacheGraph = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheGraph extends Base {
        _graphCache: InstanceType<ReturnType<ReturnType<typeof GraphCache>>>
        Graph: GraphCacheType
        GraphNodes: GraphNodeType

        constructor(...rest: any) {
            super(...rest)
            this._graphCache = new (GraphCache(graphDBHandler)(GraphEdge(graphDBHandler)(GraphNode(graphDBHandler)(GraphCacheBase))))()
            this.Graph = this._graphCache.Graph
            this.GraphNodes = this._graphCache.Nodes
        }

        override async flush() {
            await Promise.all([
                this._graphCache.flush(),
                super.flush()
            ])
        }

        override clear() {
            this._graphCache.clear()
            super.clear()
        }
    }
}

export default CacheGraph
