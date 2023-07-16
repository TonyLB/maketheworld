import { QueryCommand } from "@aws-sdk/client-dynamodb"
import { Constructor, DBHandlerBase, DBHandlerItem, DBHandlerLegalKey } from "../baseClasses"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { asyncSuppressExceptions } from "../../errors"
import mapProjectionFields from "./utils/mapProjectionFields"

type QueryExtendedProps = Partial<{
    ProjectionFields: string[];
    KeyConditionExpression: string;
    ExpressionAttributeValues: Record<string, any>;
    FilterExpression: string;
}>

type QueryKeyPropsDataCategoryIndex = {
    IndexName: 'DataCategoryIndex';
    Key: { DataCategory: string; };
}

type QueryKeyPropsScopedIdIndex = {
    IndexName: 'ScopedIdIndex';
    Key: { scopedId: string; };
}

type QueryKeyPropsPlayerIndex = {
    IndexName: 'PlayerIndex';
    Key: { player: string; };
}

type QueryKeyPropsZoneIndex = {
    IndexName: 'ZoneIndex';
    Key: { zone: string; };
}

type QueryKeyPropsConnectionIndex = {
    IndexName: 'ConnectionIndex';
    Key: { ConnectionId: string; };
}

type ExplicitIndexNameQueryKeyProps = QueryKeyPropsDataCategoryIndex | QueryKeyPropsScopedIdIndex | QueryKeyPropsPlayerIndex | QueryKeyPropsZoneIndex | QueryKeyPropsConnectionIndex

export type QueryKeyProps<KIncoming extends DBHandlerLegalKey, T extends string> = {
    Key: { [key in KIncoming]: T };
    IndexName?: ''
} | ExplicitIndexNameQueryKeyProps

type ExtractKeyReturn = {
    KeyConditionExpression: string;
    keyId: string;
}

export const withQuery = <KIncoming extends DBHandlerLegalKey, T extends string = string>() => <GBase extends Constructor<DBHandlerBase<KIncoming, T>>>(Base: GBase) => {
    return class QueryDBHandler extends Base {
        _queryExtractKeyInfo(props: QueryKeyProps<KIncoming, T>): ExtractKeyReturn {
            switch(props.IndexName) {
                case 'PlayerIndex':
                    return {
                        KeyConditionExpression: 'player = :keyId',
                        keyId: props.Key.player
                    }
                case 'ScopedIdIndex':
                    return {
                        KeyConditionExpression: 'scopedId = :keyId',
                        keyId: props.Key.scopedId
                    }
                case 'ConnectionIndex':
                    return {
                        KeyConditionExpression: 'ConnectionId = :keyId',
                        keyId: props.Key.ConnectionId
                    }
                case 'ZoneIndex':
                    return {
                        KeyConditionExpression: '#zone = :keyId',
                        keyId: props.Key.zone
                    }
                case 'DataCategoryIndex':
                    return {
                        KeyConditionExpression: 'DataCategory = :keyId',
                        keyId: props.Key.DataCategory
                    }
                default:
                    return {
                        KeyConditionExpression: `${this._internalKeyLabel} = :keyId`,
                        keyId: props.Key[this._incomingKeyLabel]
                    }
            }
        }

        async query<Query extends DBHandlerItem<KIncoming, T>>(props: QueryKeyProps<KIncoming, T> & QueryExtendedProps): Promise<Query[]> {
            const {
                IndexName = '',
                ProjectionFields: passedProjectionFields,
                KeyConditionExpression: extraExpression,
                ExpressionAttributeValues,
                FilterExpression
            } = props
            const { Items = [] } = await asyncSuppressExceptions(async () => {
                const ProjectionFields = passedProjectionFields || 
                    (IndexName
                        ? [this._incomingKeyLabel, 'DataCategory']
                        : ['DataCategory']
                    )
                const { ExpressionAttributeNames } = mapProjectionFields(ProjectionFields)
                const translateToExpressionAttributeNames = Object.entries(ExpressionAttributeNames).reduce<Record<string, string>>((previous, [key, value]) => ({ ...previous, [value]: key }), {})            
                const { KeyConditionExpression: baseExpression, keyId } = this._queryExtractKeyInfo(props)
                const replaceAttributeNames = (incoming: string): string => (
                    Object.entries(translateToExpressionAttributeNames).reduce<string>(
                        (previous, [key, translated]) => {
                            return previous.replace(new RegExp(`\\b(?<!:)${key}\\b`, 'g'), translated)
                        },
                        incoming
                    )
                )
                const KeyConditionExpression = replaceAttributeNames(
                    extraExpression
                        ? `${baseExpression} AND ${extraExpression}`
                        : baseExpression
                )
                const revisedExpressionAttributeNames = {
                    ...ExpressionAttributeNames,
                    ...(IndexName === 'ZoneIndex' ? { '#zone': 'zone' } : {})
                }
                return await this._client.send(new QueryCommand({
                    TableName: this._tableName,
                    KeyConditionExpression,
                    IndexName: IndexName.length > 0 ? IndexName : undefined,
                    ExpressionAttributeValues: marshall({
                        ':keyId': keyId,
                        ...(ExpressionAttributeValues || {})
                    }),
                    ProjectionExpression: ProjectionFields
                        .map((key) => (key === this._incomingKeyLabel ? this._internalKeyLabel : key))
                        .map((key) => (translateToExpressionAttributeNames[key] || key))
                        .join(', '),
                    ExpressionAttributeNames: (Object.keys(revisedExpressionAttributeNames).length > 0)
                        ? revisedExpressionAttributeNames
                        : undefined,
                    FilterExpression: FilterExpression ? replaceAttributeNames(FilterExpression) : undefined
                }))
            }, async () => ({ Items: [] })) as { Items: Query[] }
            return Items.map((value) => (this._remapOutgoingObject(unmarshall(value) as any))) as Query[]
        }
    }
}

export default withQuery
