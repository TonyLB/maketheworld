import { BatchWriteItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import paginateList from "./utils/paginateList"

export type BatchRequest<KIncoming extends DBHandlerLegalKey, KeyType extends string> = {
    PutRequest: DBHandlerItem<KIncoming, KeyType>
} | {
    DeleteRequest: DBHandlerKey<KIncoming, KeyType>
}

export const withBatchWrite = <KIncoming extends DBHandlerLegalKey, T extends string, GBase extends Constructor<DBHandlerBase<KIncoming, T>>>(Base: GBase) => {
    return class BatchOperationsDBHandler extends Base {
        batchWriteDispatcher(items: BatchRequest<KIncoming, T>[]) {
            const batchPromises = paginateList(items, this._writeBatchSize ?? 20)
                .filter((itemList) => (itemList.length))
                .map((itemList) => (itemList.map((item) => {
                    if ('PutRequest' in item) {
                        return { PutRequest: { Item: marshall(this._remapIncomingObject(item.PutRequest) as Record<string, any>) } }
                    }
                    else {
                        return { DeleteRequest: { Key: marshall(this._remapIncomingObject(item.DeleteRequest) as Record<string, any>) } }
                    }
                })))
                .map((itemList) => (this._client.send(new BatchWriteItemCommand({ RequestItems: {
                    [this._tableName]: itemList
                } }))))
            return Promise.all(batchPromises)
        }
    }
}

export default withBatchWrite
