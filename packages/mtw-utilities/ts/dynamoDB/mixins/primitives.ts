import { DeleteItemCommand, PutItemCommand, UpdateItemCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"

export const withPrimitives = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends Constructor<DBHandlerBase<KIncoming, T>>>(Base: GBase) => {
    return class PrimitivesDBHandler extends Base {
        async putItem(item: DBHandlerItem<KIncoming, T>) {
            return await asyncSuppressExceptions(async () => {
                await this._client.send(new PutItemCommand({
                    TableName: this._tableName,
                    Item: marshall(this._remapIncomingObject(item), { removeUndefinedValues: true })
                }))
            })
        }

        async nonCollidingPutItem(item: DBHandlerItem<KIncoming, T>): Promise<boolean> {
            let returnValue = false
            await asyncSuppressExceptions(async () => {
                await this._client.send(new PutItemCommand({
                    TableName: this._tableName,
                    Item: marshall(this._remapIncomingObject(item), { removeUndefinedValues: true }),
                    ConditionExpression: 'attribute_not_exists(DataCategory)'
                }))
                returnValue = true
            })
            return returnValue
        }

        /**
         * A `Put` under a caller-supplied condition whose failure is the answer, not an error:
         * returns `false` on `ConditionalCheckFailedException` and `true` on a write. Any other
         * failure is thrown, never suppressed (unlike `putItem`), so a caller can tell "refused by
         * the condition" from "did not write".
         */
        async conditionalPutItem(
            item: DBHandlerItem<KIncoming, T>,
            condition: { ConditionExpression: string; ExpressionAttributeNames?: Record<string, string>; ExpressionAttributeValues?: Record<string, any> }
        ): Promise<boolean> {
            const { ExpressionAttributeValues, ...rest } = condition
            try {
                await this._client.send(new PutItemCommand({
                    TableName: this._tableName,
                    Item: marshall(this._remapIncomingObject(item), { removeUndefinedValues: true }),
                    ...rest,
                    ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {})
                }))
                return true
            }
            catch (err: any) {
                if (err?.name === 'ConditionalCheckFailedException' || err?.code === 'ConditionalCheckFailedException') {
                    return false
                }
                throw err
            }
        }

        async deleteItem(key: DBHandlerKey<KIncoming, T>): Promise<void> {
            return await asyncSuppressExceptions(async () => {
                await this._client.send(new DeleteItemCommand({
                    TableName: this._tableName,
                    Key: marshall(this._remapIncomingObject(key), { removeUndefinedValues: true })
                }))
            }) as void
        }

        async primitiveUpdate(props: {
            Key: DBHandlerKey<KIncoming, T>
        } & Omit<UpdateItemCommandInput, 'TableName' | 'Key'>) {
            const { Key, ...rest } = props
            return await asyncSuppressExceptions(async () => {
                return await this._client.send(new UpdateItemCommand({
                    TableName: this._tableName,
                    Key: marshall(this._remapIncomingObject(Key), { removeUndefinedValues: true }),
                    ...rest
                }))
            })
        }
    }
}

export default withPrimitives
