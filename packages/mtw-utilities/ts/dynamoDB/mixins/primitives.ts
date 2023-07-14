import { DeleteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"

export const withPrimitives = <KIncoming extends DBHandlerLegalKey, T extends string, GBase extends Constructor<DBHandlerBase<KIncoming, T>>>(Base: GBase) => {
    return class PrimitivesDBHandler extends Base {
        async putItem(item: DBHandlerItem<KIncoming, T>) {
            return await asyncSuppressExceptions(async () => {
                await this._client.send(new PutItemCommand({
                    TableName: this._tableName,
                    Item: marshall(this._remapIncomingObject(item) as Record<string, any>, { removeUndefinedValues: true })
                }))
            })
        }

        async deleteItem(key: DBHandlerKey<KIncoming, T>): Promise<void> {
            return await asyncSuppressExceptions(async () => {
                await this._client.send(new DeleteItemCommand({
                    TableName: this._tableName,
                    Key: marshall(this._remapIncomingObject(key) as Record<string, any>, { removeUndefinedValues: true })
                }))
            }) as void
        }
    }
}

export default withPrimitives
