import { TransactWriteItem, TransactWriteItemsCommand, TransactWriteItemsCommandInput } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { UpdateExtendedProps } from "./update"
import withGetOperations from "./get"
import withUpdate from "./update"
import { unique } from "../../lists"

type TransactionRequestUpdate<KIncoming extends DBHandlerLegalKey, KeyType extends string> = { Key: DBHandlerKey<KIncoming, KeyType> } & UpdateExtendedProps<Record<string, any>>

export type TransactionRequest<KIncoming extends DBHandlerLegalKey, KeyType extends string> = {
    Put: DBHandlerItem<KIncoming, KeyType>
} | {
    Update: TransactionRequestUpdate<KIncoming, KeyType>;
} | {
    Delete: DBHandlerKey<KIncoming, KeyType>
}

export const withTransaction = <KIncoming extends DBHandlerLegalKey, T extends string, GBase extends ReturnType<typeof withUpdate<KIncoming, T, ReturnType<typeof withGetOperations<KIncoming, T, Constructor<DBHandlerBase<KIncoming, T>>>>>>>(Base: GBase) => {
    return class TransactionDBHandler extends Base {
        async transactWrite(items: TransactionRequest<KIncoming, T>[]) {
            const itemsToFetch = items.reduce<TransactionRequestUpdate<KIncoming, T>[]>((previous, item) => ('Update' in item ? [...previous, item.Update] : previous), [])
            const aggregateProjectionFields = unique(
                [this._incomingKeyLabel, 'DataCategory'],
                ...itemsToFetch.map(({ updateKeys }) => (updateKeys))
            )
            const fetchedItems = await this.getItems({
                Keys: itemsToFetch.map((item) => (item.Key)),
                ProjectionFields: aggregateProjectionFields
            })

            const transactions = items.map<TransactWriteItem | undefined>((item) => {
                if ('Put' in item) {
                    return {
                        Put: {
                            Item: marshall(this._remapIncomingObject(item.Put)) as Record<string, any>,
                            TableName: this._tableName
                        }
                    }
                }
                if ('Delete' in item) {
                    return {
                        Delete: {
                            Key: marshall(this._remapIncomingObject(item.Delete)) as Record<string, any>,
                            TableName: this._tableName
                        }
                    }
                }
                if ('Update' in item) {
                    const fetchedItem = fetchedItems.find((checkItem) => (checkItem[this._incomingKeyLabel] === item.Update.Key[this._incomingKeyLabel] && checkItem.DataCategory === item.Update.Key.DataCategory))
                    if (!fetchedItem) {
                        return undefined
                    }
                    const updateTransaction = this._optimisticUpdateFactory(fetchedItem, item.Update)
                    if (!updateTransaction) {
                        return undefined
                    }
                    return {
                        Update: {
                            TableName: this._tableName,
                            ...updateTransaction
                        }
                    } as TransactWriteItem
                }
                return undefined
            }).filter((value): value is TransactWriteItem => (typeof value !== 'undefined'))
            await this._client.send(new TransactWriteItemsCommand({ TransactItems: transactions }))
        }
    }
}

export default withTransaction
