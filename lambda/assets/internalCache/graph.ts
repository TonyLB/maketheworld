import { CacheBase as GraphCacheBase, GraphDBHandler } from "@tonylb/mtw-utilities/ts/graphStorage/cache/baseClasses"
import GraphCache from "@tonylb/mtw-utilities/ts/graphStorage/cache"
import GraphNode from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphNode"
import GraphEdge from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphEdge"
import { CacheConstructor } from "./baseClasses"
import withGetOperations from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/get"
import { DBHandlerBase } from "@tonylb/mtw-utilities/ts/dynamoDB/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import withPrimitives from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/primitives"

export const graphDBHandler: GraphDBHandler = new (withPrimitives<'PrimaryKey', string>()(withGetOperations<'PrimaryKey', string>()(DBHandlerBase)))({
    client: assetDB._client,
    tableName: assetDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'AssetId',
    options: { getBatchSize: 50 }
})

export type GraphCacheType = InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Graph"]
export type GraphNodeType = InstanceType<ReturnType<ReturnType<typeof GraphCache>>>["Nodes"]
