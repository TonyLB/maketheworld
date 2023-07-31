import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import withGetOperations from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/get"
import { DBHandlerBase } from "@tonylb/mtw-utilities/dist/dynamoDB/baseClasses"
import withUpdate from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/update"
import withTransaction from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/transact"
import GraphNode from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphNode"
import GraphCache from "@tonylb/mtw-utilities/dist/graphStorage/cache"
import withPrimitives from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/primitives"
import GraphEdge from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphEdge"
import { CacheBase as GraphCacheBase } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"

const graphStorageDBMixin = withTransaction<'PrimaryKey'>()(
    withUpdate<'PrimaryKey'>()(
        withPrimitives<'PrimaryKey'>()(
            withGetOperations<'PrimaryKey'>()(DBHandlerBase)
        )
    )
)

export const graphStorageDB = new graphStorageDBMixin({
    client: ephemeraDB._client,
    tableName: ephemeraDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'EphemeraId',
    options: { getBatchSize: 50 }
})

export const graphCache = new (GraphCache(graphStorageDB)(GraphNode(graphStorageDB)(GraphEdge(graphStorageDB)(GraphCacheBase))))()
