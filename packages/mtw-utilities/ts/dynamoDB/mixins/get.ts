import { BatchGetItemCommand, BatchWriteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"
import paginateList from "./utils/paginateList"
import mapProjectionFields from './utils/mapProjectionFields'

type GetItemExtendedProps = {
    ProjectionFields?: string[];
    ExpressionAttributeNames?: Record<string, string>;
    ConsistentRead?: boolean;
}

export const withGetOperations = <KIncoming extends string, KInternal extends string, T extends string, GBase extends Constructor<DBHandlerBase<KIncoming, KInternal, T>>>(Base: GBase) => {
    return class GetOperationsDBHandler extends Base {
        async getItem<Get extends Record<string, any>>(props: { Key: ({ [key in KIncoming]: T } & { DataCategory: string }) } & GetItemExtendedProps): Promise<Get | undefined> {
            return await asyncSuppressExceptions(async () => {
                const { ProjectionFields, ExpressionAttributeNames } = mapProjectionFields((props.ProjectionFields || []).map((projectionField) => (projectionField === this._incomingKeyLabel ? this._internalKeyLabel : projectionField)))
                const { Item = null } = await this._client.send(new GetItemCommand({
                    TableName: this._tableName,
                    Key: marshall(this._remapIncomingObject(props.Key)),
                    ProjectionExpression: ProjectionFields.length ? ProjectionFields.join(', ') : this._internalKeyLabel,
                    ...(Object.keys(ExpressionAttributeNames).length ? { ExpressionAttributeNames } : {}),
                    ConsistentRead: props.ConsistentRead
                }))
                return Item ? this._remapOutgoingObject(unmarshall(Item) as { [key in KInternal]: T } & Record<string, any>) : undefined
            }, async () => (undefined)) as Get | undefined
        }

        async getItems<Get extends Record<string, any>>(props: { Keys: ({ [key in KIncoming]: T } & { DataCategory: string })[] } & GetItemExtendedProps): Promise<Get[]> {
            const { ProjectionFields, ExpressionAttributeNames } = mapProjectionFields((props.ProjectionFields || []).map((projectionField) => (projectionField === this._incomingKeyLabel ? this._internalKeyLabel : projectionField)))
            const batchPromises = paginateList(props.Keys, this._getBatchSize ?? 40)
                .filter((itemList) => (itemList.length))
                .map((itemList) => (this._client.send(new BatchGetItemCommand({ RequestItems: {
                    [this._tableName]: {
                        Keys: itemList.map((item) => (marshall(this._remapIncomingObject(item)))),
                        ProjectionExpression: ProjectionFields.length ? ProjectionFields.join(', ') : this._internalKeyLabel,
                        ExpressionAttributeNames: Object.keys(ExpressionAttributeNames).length ? ExpressionAttributeNames : undefined
                    }
                } }))))
            const outcomes = await Promise.all(batchPromises)
            return outcomes.reduce<Get[]>((previous, { Responses = {} }) => {
                return [
                    ...previous,
                    ...(Responses[this._tableName] || []).map((value) => (this._remapOutgoingObject(unmarshall(value) as { [key in KInternal]: T } & Record<string, any>) as Get))
                ]
            }, [])
        }
    }
}

export default withGetOperations
