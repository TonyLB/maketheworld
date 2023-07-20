import { DeleteItemCommand, PutItemCommand, UpdateItemCommand, UpdateItemCommandInput } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"

//
// TODO: Apply curried mixin pattern to other mixins and see if it can handle the complexity of DBHandler's connections
//
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
