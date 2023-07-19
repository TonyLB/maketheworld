import { CacheBase as GraphCacheBase, GraphDBHandler } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import GraphCache from "@tonylb/mtw-utilities/dist/graphStorage/cache"
import GraphNode from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphNode"
import GraphEdge from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphEdge"
import { CacheBase, CacheConstructor } from "./baseClasses"
import withGetOperations from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/get"
import { DBHandlerBase } from "@tonylb/mtw-utilities/dist/dynamoDB/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

const graphDBHandler: GraphDBHandler = new (withGetOperations<'PrimaryKey', string>()(DBHandlerBase))({
    client: ephemeraDB._client,
    tableName: ephemeraDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'EphemeraId',
    options: { getBatchSize: 50 }
})

export const CacheGraph = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CachGraph extends Base {
        Graph: InstanceType<ReturnType<typeof GraphCache>>

        constructor(...rest: any) {
            super(...rest)
            this.Graph = new (GraphCache(GraphEdge(graphDBHandler)(GraphNode(graphDBHandler)(GraphCacheBase))))()
        }
    }
}

export default CacheGraph
