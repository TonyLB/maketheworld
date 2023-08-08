import { TransactWriteItem, TransactWriteItemsCommand, TransactWriteItemsCommandInput } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { UpdateExtendedProps } from "./update"
import withGetOperations from "./get"
import withUpdate from "./update"
import { unique } from "../../lists"
import mapProjectionFields from "./utils/mapProjectionFields"

type TransactionRequestUpdate<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = { Key: DBHandlerKey<KIncoming, KeyType> } & UpdateExtendedProps<KIncoming, KeyType>
export type TransactionRequestConditionCheck<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Key: DBHandlerKey<KIncoming, KeyType>;
    ProjectionFields: string[];
    ConditionExpression: string;
    ExpressionAttributeValues?: Record<string, any>;
}
export type TransactionRequestPrimitiveUpdate<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Key: DBHandlerKey<KIncoming, KeyType>;
    ProjectionFields: string[];
    UpdateExpression: string;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Record<string, any>;
}

export type TransactionRequest<KIncoming extends DBHandlerLegalKey, KeyType extends string = string> = {
    Put: DBHandlerItem<KIncoming, KeyType>
} | {
    Update: TransactionRequestUpdate<KIncoming, KeyType>;
} | {
    PrimitiveUpdate: TransactionRequestPrimitiveUpdate<KIncoming, KeyType>;
} | {
    Delete: DBHandlerKey<KIncoming, KeyType>
} | {
    ConditionCheck: TransactionRequestConditionCheck<KIncoming, KeyType>;
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

            const transactions = items.map<TransactWriteItem[]>((item) => {
                if ('Put' in item) {
                    const returnValue = {
                        Put: {
                            Item: marshall(this._remapIncomingObject(item.Put), { removeUndefinedValues: true }),
                            TableName: this._tableName
                        }
                    }
                    return [returnValue]
                }
                if ('Delete' in item) {
                    return [{
                        Delete: {
                            Key: marshall(this._remapIncomingObject(item.Delete), { removeUndefinedValues: true }),
                            TableName: this._tableName
                        }
                    }]
                }
                if ('Update' in item) {
                    const fetchedItem = item.Update.priorFetch || fetchedItems.find((checkItem) => (checkItem[this._incomingKeyLabel] === item.Update.Key[this._incomingKeyLabel] && checkItem.DataCategory === item.Update.Key.DataCategory))
                    const updateTransaction = this._optimisticUpdateFactory(fetchedItem, item.Update)
                    if (updateTransaction.action === 'ignore') {
                        return []
                    }
                    else if (updateTransaction.action === 'delete') {
                        return updateTransaction.deletes.map((deleteItem) => ({
                            Delete: {
                                TableName: this._tableName,
                                ...deleteItem
                            }
                        }))
                    }
                    else {
                        return [{
                            Update: {
                                TableName: this._tableName,
                                ...updateTransaction.update
                            }
                        } as TransactWriteItem]
                    }
                }
                if ('ConditionCheck' in item) {
                    const { ExpressionAttributeNames } = mapProjectionFields(item.ConditionCheck.ProjectionFields)
                    const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})            
                    const replaceAttributeNames = (incoming: string): string => (
                        Object.entries(translateToExpressionAttributeNames).reduce<string>(
                            (previous, [key, translated]) => {
                                return previous.replace(new RegExp(`\\b(?<!:)${key}\\b`, 'g'), translated)
                            },
                            incoming
                        )
                    )
                    return [{
                        ConditionCheck: {
                            TableName: this._tableName,
                            Key: marshall(this._remapIncomingObject(item.ConditionCheck.Key), { removeUndefinedValues: true }),
                            ConditionExpression: replaceAttributeNames(item.ConditionCheck.ConditionExpression),
                            ...(Object.keys(ExpressionAttributeNames).length > 0 ? { ExpressionAttributeNames } : {}),
                            ...(item.ConditionCheck.ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(item.ConditionCheck.ExpressionAttributeValues, { removeUndefinedValues: true }) } : {})
                        }
                    }]
                }
                if ('PrimitiveUpdate' in item) {
                    const { ExpressionAttributeNames } = mapProjectionFields(item.PrimitiveUpdate.ProjectionFields)
                    const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})            
                    const replaceAttributeNames = (incoming: string): string => (
                        Object.entries(translateToExpressionAttributeNames).reduce<string>(
                            (previous, [key, translated]) => {
                                return previous.replace(new RegExp(`\\b(?<!:)${key}\\b`, 'g'), translated)
                            },
                            incoming
                        )
                    )
                    return [{
                        Update: {
                            TableName: this._tableName,
                            Key: marshall(this._remapIncomingObject(item.PrimitiveUpdate.Key), { removeUndefinedValues: true }),
                            UpdateExpression: replaceAttributeNames(item.PrimitiveUpdate.UpdateExpression),
                            ...(item.PrimitiveUpdate.ConditionExpression ? { ConditionExpression: replaceAttributeNames(item.PrimitiveUpdate.ConditionExpression) } : {}),
                            ...(Object.keys(ExpressionAttributeNames).length > 0 ? { ExpressionAttributeNames } : {}),
                            ...(item.PrimitiveUpdate.ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(item.PrimitiveUpdate.ExpressionAttributeValues, { removeUndefinedValues: true }) } : {})
                        }
                    }]
                }
                return []
            }).flat()
            await this._client.send(new TransactWriteItemsCommand({ TransactItems: transactions }))
        }
    }
}

export default withTransaction
