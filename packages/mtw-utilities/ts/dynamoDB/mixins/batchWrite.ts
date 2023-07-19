import { BatchWriteItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import paginateList from "./utils/paginateList"
import mapProjectionFields from "./utils/mapProjectionFields"

export type BatchRequest<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    PutRequest: DBHandlerItem<KIncoming, KeyType>
} | {
    DeleteRequest: DBHandlerKey<KIncoming, KeyType>
}

export const withBatchWrite = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends Constructor<DBHandlerBase<KIncoming, T>>>(Base: GBase) => {
    return class BatchOperationsDBHandler extends Base {
        batchWriteDispatcher(items: BatchRequest<KIncoming, T>[]) {
            const batchPromises = paginateList(items, this._writeBatchSize ?? 20)
                .filter((itemList) => (itemList.length))
                .map((itemList) => (itemList.map((item) => {
                    if ('PutRequest' in item) {
                        const { ExpressionAttributeNames } = mapProjectionFields(Object.keys(item.PutRequest))
                        const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})
                        const remappedPut = Object.entries(item.PutRequest).reduce<Record<string, any>>((previous, [key, value]) => ({ ...previous, [translateToExpressionAttributeNames[key] ?? key]: value }), {}) as DBHandlerItem<KIncoming, T>
                        return { PutRequest: {
                            Item: marshall(this._remapIncomingObject(remappedPut)),
                            ...(Object.keys(ExpressionAttributeNames).length > 0 ? { ExpressionAttributeNames } : {})
                        } }
                    }
                    else {
                        return { DeleteRequest: { Key: marshall(this._remapIncomingObject(item.DeleteRequest)) } }
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
