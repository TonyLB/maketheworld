import { BatchGetItemCommand, BatchWriteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerKey, DBHandlerLegalKey } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"
import paginateList from "./utils/paginateList"
import mapProjectionFields from './utils/mapProjectionFields'

type GetItemExtendedProps = {
    ProjectionFields?: string[];
    getAllFields?: boolean;  // When true, omits ProjectionExpression to get all attributes
    ExpressionAttributeNames?: Record<string, string>;
    ConsistentRead?: boolean;
}

export const withGetOperations = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends Constructor<DBHandlerBase<KIncoming, T>>>(Base: GBase) => {
    return class GetOperationsDBHandler extends Base {
        async getItem<Get extends Partial<DBHandlerItem<KIncoming, T>>>(props: { Key: DBHandlerKey<KIncoming, T> } & GetItemExtendedProps): Promise<Get | undefined> {
            return await asyncSuppressExceptions(async () => {
                const { ProjectionFields, ExpressionAttributeNames } = mapProjectionFields((props.ProjectionFields || []).map((projectionField) => (projectionField === this._incomingKeyLabel ? this._internalKeyLabel : projectionField)))
                // Build the command object conditionally based on getAllFields
                const commandInput: any = {
                    TableName: this._tableName,
                    Key: marshall(this._remapIncomingObject(props.Key)),
                    ConsistentRead: props.ConsistentRead
                }
                
                // Only add ProjectionExpression if getAllFields is not true
                if (!props.getAllFields) {
                    commandInput.ProjectionExpression = ProjectionFields.length ? ProjectionFields.join(', ') : this._internalKeyLabel
                    if (Object.keys(ExpressionAttributeNames).length) {
                        commandInput.ExpressionAttributeNames = ExpressionAttributeNames
                    }
                }
                
                const { Item = null } = await this._client.send(new GetItemCommand(commandInput))
                return Item ? this._remapOutgoingObject(unmarshall(Item) as DBHandlerItem<DBHandlerLegalKey, T>) : undefined
            }, async () => (undefined)) as Get | undefined
        }

        async getItems<Get extends Partial<DBHandlerItem<KIncoming, T>>>(props: { Keys: DBHandlerKey<KIncoming, T>[] } & GetItemExtendedProps): Promise<Get[]> {
            const { ProjectionFields, ExpressionAttributeNames } = mapProjectionFields((props.ProjectionFields || []).map((projectionField) => (projectionField === this._incomingKeyLabel ? this._internalKeyLabel : projectionField)))
            const batchPromises = paginateList(props.Keys, this._getBatchSize ?? 40)
                .filter((itemList) => (itemList.length))
                .map(async (itemList) => {
                    const Keys = itemList.map((item) => (marshall(this._remapIncomingObject(item))))
                    // Build the request items conditionally based on getAllFields
                    const requestItem: any = {
                        Keys,
                        ConsistentRead: props.ConsistentRead
                    }
                    
                    // Only add ProjectionExpression if getAllFields is not true
                    if (!props.getAllFields) {
                        requestItem.ProjectionExpression = ProjectionFields.length ? ProjectionFields.join(', ') : this._internalKeyLabel
                        if (Object.keys(ExpressionAttributeNames).length) {
                            requestItem.ExpressionAttributeNames = ExpressionAttributeNames
                        }
                    }
                    
                    return await this._client.send(new BatchGetItemCommand({ RequestItems: {
                        [this._tableName]: requestItem
                    } }))
                })
            const outcomes = await Promise.all(batchPromises)
            return outcomes.reduce<Get[]>((previous, { Responses = {} }) => {
                return [
                    ...previous,
                    ...(Responses[this._tableName] || []).map((value) => (this._remapOutgoingObject(unmarshall(value) as DBHandlerItem<DBHandlerLegalKey, T>) as Get))
                ]
            }, [])
        }
    }
}

export default withGetOperations
