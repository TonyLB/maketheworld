import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import withGetOperations from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/get"
import { DBHandlerBase } from "@tonylb/mtw-utilities/dist/dynamoDB/baseClasses"
import withUpdate from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/update"
import withTransaction from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/transact"
import GraphNode from "@tonylb/mtw-utilities/dist/graphStorage/cache/graphNode"
import { CacheBase } from "../internalCache/baseClasses"
import { EphemeraId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import GraphCache from "@tonylb/mtw-utilities/dist/graphStorage/cache"

const graphStorageDBMixin = withTransaction<'PrimaryKey'>()(
    withUpdate<'PrimaryKey'>()(
        withGetOperations<'PrimaryKey'>()(DBHandlerBase<'PrimaryKey'>)
    )
)

export const graphStorageDB = new graphStorageDBMixin({
    client: ephemeraDB._client,
    tableName: ephemeraDB._tableName,
    incomingKeyLabel: 'PrimaryKey',
    internalKeyLabel: 'EphemeraId',
    options: { getBatchSize: 50 }
})

export const graphCache = new (GraphCache(graphStorageDB)(GraphNode<string, typeof graphStorageDB>(graphStorageDB)(CacheBase)))()
