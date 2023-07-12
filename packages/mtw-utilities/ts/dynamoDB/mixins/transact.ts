import { TransactWriteItem, TransactWriteItemsCommand, TransactWriteItemsCommandInput } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import paginateList from "./utils/paginateList"

export type TransactionRequest<KIncoming extends Exclude<string, 'DataCategory'>, KeyType extends Exclude<string, 'DataCategory'>> = {
    Put: DBHandlerItem<KIncoming, KeyType>
} | {
    Update: {
        Key: DBHandlerKey<KIncoming, KeyType>;
        UpdateExpression: string;
        ExpressionAttributeValues: Record<string, any>;
        ConditionExpression: string;
    }
} | {
    Delete: DBHandlerKey<KIncoming, KeyType>
}

export const withTransaction = <KIncoming extends Exclude<string, 'DataCategory'>, KInternal extends Exclude<string, 'DataCategory'>, T extends string, GBase extends Constructor<DBHandlerBase<KIncoming, KInternal, T>>>(Base: GBase) => {
    return class TransactionDBHandler extends Base {
        async transactWrite(items: TransactionRequest<KIncoming, T>[]) {
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
                    //
                    // TODO: Refactor transactWrite to extract possible reserved words from UpdateExpression and
                    // ConditionExpression, and generate an ExpressionAttributeNames as needed
                    //
                    return {
                        Update: {
                            Key: marshall(this._remapIncomingObject(item.Update.Key)) as Record<string, any>,
                            TableName: this._tableName,
                            UpdateExpression: item.Update.UpdateExpression,
                            ExpressionAttributeValues: item.Update.ExpressionAttributeValues ? marshall(item.Update.ExpressionAttributeValues, { removeUndefinedValues: true }) : undefined,
                            ConditionExpression: item.Update.ConditionExpression
                        }
                    }
                }
                return undefined
            }).filter((value): value is TransactWriteItem => (typeof value !== 'undefined'))
            await this._client.send(new TransactWriteItemsCommand({ TransactItems: transactions }))
        }
    }
}

export default withTransaction
