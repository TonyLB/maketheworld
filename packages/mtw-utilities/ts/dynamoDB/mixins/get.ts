import { BatchWriteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors";

type GetItemExtendedProps = {
    ProjectionFields?: string[];
    ExpressionAttributeNames?: Record<string, string>;
    ConsistentRead?: boolean;
}

const reservedFields = ['name', 'key', 'value', 'zone']

const mapIncomingFields = (projectionFields: string[]): { ProjectionFields: string[], ExpressionAttributeNames: Record<string, string> } => {
    return projectionFields.reduce<{ ProjectionFields: string[], ExpressionAttributeNames: Record<string, string> }>((previous, projectionField) => {
        if (reservedFields.includes(projectionField.toLowerCase())) {
            return {
                ProjectionFields: [
                    ...previous.ProjectionFields,
                    `#${projectionField.toLowerCase()}`
                ],
                ExpressionAttributeNames: {
                    ...previous.ExpressionAttributeNames,
                    [`#${projectionField.toLowerCase()}`]: projectionField
                }
            }
        }
        return {
            ...previous,
            ProjectionFields: [
                ...previous.ProjectionFields,
                projectionField
            ]
        }
    }, { ProjectionFields: [], ExpressionAttributeNames: {} })
}

export const withGetOperations = <KIncoming extends string, KInternal extends string, T extends string, GBase extends Constructor<DBHandlerBase<KIncoming, KInternal, T>>>(Base: GBase) => {
    return class GetOperationsDBHandler extends Base {
        async get<Get extends Record<string, any>>(props: { Key: ({ [key in KIncoming]: T } & { DataCategory: string }) } & GetItemExtendedProps): Promise<Get | undefined> {
            //
            // TODO: Gather a list of common ExpressionAttributeName translations (like "Name"):
            //    name, zone, value, key, 
            //
            // TODO: Automatically append common ExpressionAttributeName translations (like "Name") and remap entries in ProjectionFields
            //
            return await asyncSuppressExceptions(async () => {
                const { ProjectionFields, ExpressionAttributeNames } = mapIncomingFields(props.ProjectionFields || [])
                const { Item = null } = await this._client.send(new GetItemCommand({
                    TableName: this._tableName,
                    Key: marshall(this._remapIncomingObject(props.Key as { [key in KIncoming]: T } & Record<string, any>)),
                    ProjectionExpression: ProjectionFields.length ? ProjectionFields.join(', ') : this._internalKeyLabel,
                    ...(Object.keys(ExpressionAttributeNames).length ? { ExpressionAttributeNames } : {}),
                    ConsistentRead: props.ConsistentRead
                }))
                return Item ? this._remapOutgoingObject(unmarshall(Item) as { [key in KInternal]: T } & Record<string, any>) : undefined
            }, async () => (undefined)) as Get | undefined
        }
    }
}

export default withGetOperations
