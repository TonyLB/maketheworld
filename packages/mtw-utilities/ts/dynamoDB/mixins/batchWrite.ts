import { BatchWriteItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"

const paginateList = <V extends any>(items: V[], pageSize: number): V[][] => {
    const { requestLists, current } = items
        .reduce<{ requestLists: V[][], current: V[] }>((({ current, requestLists }, item) => {
            if (current.length >= pageSize) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    return [...requestLists, current]
}

type BatchRequest<V> = {
    PutRequest: V
} | {
    DeleteRequest: V
}

export const withBatchOperations = <KIncoming extends string, KInternal extends string, T extends string, GBase extends Constructor<DBHandlerBase<KIncoming, KInternal, T>>>(Base: GBase) => {
    return class BatchOperationsDBHandler extends Base {
        batchWriteDispatcher<V extends { [key in KIncoming]: T }>(items: BatchRequest<V>[]) {
            const batchPromises = paginateList(items, this._writeBatchSize ?? 20)
                .filter((itemList) => (itemList.length))
                .map((itemList) => (itemList.map((item) => {
                    if ('PutRequest' in item) {
                        return { PutRequest: { Item: marshall(this._remapIncomingObject(item.PutRequest)) } }
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

export default withBatchOperations
