import { DeleteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"

export const withPrimitives = <KIncoming extends string, KInternal extends string, T extends string, GBase extends Constructor<DBHandlerBase<KIncoming, KInternal, T>>>(Base: GBase) => {
    return class PrimitivesDBHandler extends Base {
        async putItem(item: (Record<string, any> & { [key in KIncoming]: T })) {
            return await asyncSuppressExceptions(async () => {
                await this._client.send(new PutItemCommand({
                    TableName: this._tableName,
                    Item: marshall(this._remapIncomingObject(item), { removeUndefinedValues: true })
                }))
            })
        }

        async deleteItem(key: { [key in KIncoming]: T } & { DataCategory: string }): Promise<void> {
            return await asyncSuppressExceptions(async () => {
                await this._client.send(new DeleteItemCommand({
                    TableName: this._tableName,
                    Key: marshall(this._remapIncomingObject(key), { removeUndefinedValues: true })
                }))
            }) as void
        }
    }
}

export default withPrimitives
