import { CacheBase as GraphCacheBase, GraphDBHandler } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import { GraphCache } from "@tonylb/mtw-utilities/dist/graphStorage/cache"
import GraphNode from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphNode"
import GraphEdge from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphEdge"
import { CacheBase, CacheConstructor } from "./baseClasses"
import withGetOperations from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/get"
import { DBHandlerBase } from "@tonylb/mtw-utilities/dist/dynamoDB/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import withPrimitives from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/primitives"

const graphDBHandler: GraphDBHandler = new (withPrimitives<'PrimaryKey', string>()(withGetOperations<'PrimaryKey', string>()(DBHandlerBase)))({
    client: ephemeraDB._client,
    tableName: ephemeraDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'EphemeraId',
    options: { getBatchSize: 50 }
})

export const CacheGraph = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CachGraph extends Base {
        _graphCache: InstanceType<ReturnType<ReturnType<typeof GraphCache>>>
        Graph: InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Graph"]

        constructor(...rest: any) {
            super(...rest)
            this._graphCache = new (GraphCache(graphDBHandler)(GraphEdge(graphDBHandler)(GraphNode(graphDBHandler)(GraphCacheBase))))()
            this.Graph = this._graphCache.Graph
        }

        override async flush() {
            await Promise.all([
                this.Graph.flush(),
                super.flush()
            ])
        }
    }
}

export default CacheGraph
