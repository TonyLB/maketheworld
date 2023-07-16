import { TransactWriteItem, TransactWriteItemsCommand, TransactWriteItemsCommandInput } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { UpdateExtendedProps } from "./update"
import withGetOperations from "./get"
import withUpdate from "./update"
import { unique } from "../../lists"
import mapProjectionFields from "./utils/mapProjectionFields"

type TransactionRequestUpdate<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = { Key: DBHandlerKey<KIncoming, KeyType> } & UpdateExtendedProps<KIncoming, KeyType>

export type TransactionRequest<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Put: DBHandlerItem<KIncoming, KeyType>
} | {
    Update: TransactionRequestUpdate<KIncoming, KeyType>;
} | {
    Delete: DBHandlerKey<KIncoming, KeyType>
}

export const withTransaction = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends
        ReturnType<ReturnType<typeof withUpdate<KIncoming, T>>> &
        ReturnType<ReturnType<typeof withGetOperations<KIncoming, T>>>>(Base: GBase) => {
    return class TransactionDBHandler extends Base {
        async transactWrite(items: TransactionRequest<KIncoming, T>[]) {
            //
            // TODO: ISS2713: Wrap transaction call in exponentialBackoffWrapper if there are any Updates in it
            //
            const itemsToFetch = items.reduce<TransactionRequestUpdate<KIncoming, T>[]>((previous, item) => ('Update' in item && (!('priorFetch' in item.Update)) ? [...previous, item.Update] : previous), [])
            const aggregateProjectionFields = unique(
                [this._incomingKeyLabel, 'DataCategory'],
                ...itemsToFetch.map(({ updateKeys }) => (updateKeys))
            )
            const fetchedItems = itemsToFetch.length ? await this.getItems<DBHandlerItem<KIncoming, T>>({
                Keys: itemsToFetch.map((item) => (item.Key)),
                ProjectionFields: aggregateProjectionFields
            }) : []

            const transactions = items.map<TransactWriteItem | undefined>((item) => {
                if ('Put' in item) {
                    const { ExpressionAttributeNames } = mapProjectionFields(Object.keys(item.Put))
                    const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})
                    const remappedPut = Object.entries(item.Put).reduce<Record<string, any>>((previous, [key, value]) => ({ ...previous, [translateToExpressionAttributeNames[key] ?? key]: value }), {}) as DBHandlerItem<KIncoming, T>
                    return {
                        Put: {
                            Item: marshall(this._remapIncomingObject(remappedPut), { removeUndefinedValues: true }),
                            TableName: this._tableName,
                            ...(Object.keys(ExpressionAttributeNames).length ? { ExpressionAttributeNames }: {})
                        }
                    }
                }
                if ('Delete' in item) {
                    return {
                        Delete: {
                            Key: marshall(this._remapIncomingObject(item.Delete), { removeUndefinedValues: true }),
                            TableName: this._tableName
                        }
                    }
                }
                if ('Update' in item) {
                    const fetchedItem = item.Update.priorFetch || fetchedItems.find((checkItem) => (checkItem[this._incomingKeyLabel] === item.Update.Key[this._incomingKeyLabel] && checkItem.DataCategory === item.Update.Key.DataCategory))
                    const updateTransaction = this._optimisticUpdateFactory(fetchedItem, item.Update)
                    if (updateTransaction.action === 'ignore') {
                        return undefined
                    }
                    else if (updateTransaction.action === 'delete') {
                        return {
                            Delete: {
                                TableName: this._tableName,
                                ...updateTransaction.delete
                            }
                        }
                    }
                    else {
                        return {
                            Update: {
                                TableName: this._tableName,
                                ...updateTransaction.update
                            }
                        } as TransactWriteItem    
                    }
                }
                return undefined
            }).filter((value): value is TransactWriteItem => (typeof value !== 'undefined'))
            await this._client.send(new TransactWriteItemsCommand({ TransactItems: transactions }))
        }
    }
}

export default withTransaction
