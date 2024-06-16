import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import withGetOperations from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/get"
import { DBHandlerBase } from "@tonylb/mtw-utilities/ts/dynamoDB/baseClasses"
import withUpdate from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/update"
import withTransaction from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/transact"
import GraphNode from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphNode"
import GraphCache from "@tonylb/mtw-utilities/ts/graphStorage/cache"
import withPrimitives from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/primitives"
import GraphEdge from "@tonylb/mtw-utilities/ts/graphStorage/cache/graphEdge"
import { CacheBase as GraphCacheBase } from "@tonylb/mtw-utilities/ts/graphStorage/cache/baseClasses"
import withBatchWrite from "@tonylb/mtw-utilities/ts/dynamoDB/mixins/batchWrite"

const graphStorageDBMixin = withTransaction<'PrimaryKey'>()(
    withBatchWrite<'PrimaryKey'>()(
        withUpdate<'PrimaryKey'>()(
            withPrimitives<'PrimaryKey'>()(
                withGetOperations<'PrimaryKey'>()(DBHandlerBase)
            )
        )
    )
)

export const graphStorageDB = new graphStorageDBMixin({
    client: assetDB._client,
    tableName: assetDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'AssetId',
    options: { getBatchSize: 50 }
})

export const graphCache = new (GraphCache(graphStorageDB)(GraphNode(graphStorageDB)(GraphEdge(graphStorageDB)(GraphCacheBase))))()
