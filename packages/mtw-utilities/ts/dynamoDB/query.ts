import {
    QueryCommand,
    DynamoDBClient
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { asyncSuppressExceptions } from '../errors'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`
const messageTable = `${TABLE_PREFIX}_messages`

type QueryExtendedProps = Partial<{
    ProjectionFields: string[];
    KeyConditionExpression: string;
    ExpressionAttributeNames: Record<string, string>;
    ExpressionAttributeValues: Record<string, any>;
    FilterExpression: string;
}>

type QueryKeyPropsDataCategoryIndex = {
    IndexName: 'DataCategoryIndex';
    DataCategory: string;
}

type QueryKeyPropsScopedIdIndex = {
    IndexName: 'ScopedIdIndex';
    scopedId: string;
}

type QueryKeyPropsPlayerIndex = {
    IndexName: 'PlayerIndex';
    player: string;
}

type QueryKeyPropsZoneIndex = {
    IndexName: 'ZoneIndex';
    zone: string;
}

type QueryKeyPropsConnectionIndex = {
    IndexName: 'ConnectionIndex';
    ConnectionId: string;
}

type ExtractKeyReturn = {
    KeyConditionExpression: string;
    keyId: string;
}

export type AssetQueryKeyProps = {
    IndexName?: '';
    AssetId: string;
} | QueryKeyPropsDataCategoryIndex | QueryKeyPropsPlayerIndex | QueryKeyPropsZoneIndex | QueryKeyPropsScopedIdIndex | QueryKeyPropsConnectionIndex | QueryKeyPropsDataCategoryIndex

export const assetExtractKeyInfo = (props: AssetQueryKeyProps): ExtractKeyReturn => {
    switch(props.IndexName) {
        case 'PlayerIndex':
            return {
                KeyConditionExpression: 'player = :keyId',
                keyId: props.player
            }
        case 'ScopedIdIndex':
            return {
                KeyConditionExpression: 'scopedId = :keyId',
                keyId: props.scopedId
            }
        case 'ConnectionIndex':
            return {
                KeyConditionExpression: 'ConnectionId = :keyId',
                keyId: props.ConnectionId
            }
        case 'ZoneIndex':
            return {
                KeyConditionExpression: '#zone = :keyId',
                keyId: props.zone
            }
        case 'DataCategoryIndex':
            return {
                KeyConditionExpression: 'DataCategory = :keyId',
                keyId: props.DataCategory
            }
        default:
            return {
                KeyConditionExpression: 'AssetId = :keyId',
                keyId: props.AssetId
            }
    }    
}

export type EphemeraQueryKeyProps = {
    IndexName?: '';
    EphemeraId: string;
} | QueryKeyPropsDataCategoryIndex | QueryKeyPropsPlayerIndex | QueryKeyPropsZoneIndex | QueryKeyPropsScopedIdIndex | QueryKeyPropsConnectionIndex | QueryKeyPropsDataCategoryIndex

export const ephemeraExtractKeyInfo = (props: EphemeraQueryKeyProps): ExtractKeyReturn => {
    switch(props.IndexName) {
        case 'PlayerIndex':
            return {
                KeyConditionExpression: 'player = :keyId',
                keyId: props.player
            }
        case 'ScopedIdIndex':
            return {
                KeyConditionExpression: 'scopedId = :keyId',
                keyId: props.scopedId
            }
        case 'ConnectionIndex':
            return {
                KeyConditionExpression: 'ConnectionId = :keyId',
                keyId: props.ConnectionId
            }
        case 'ZoneIndex':
            return {
                KeyConditionExpression: '#zone = :keyId',
                keyId: props.zone
            }
        case 'DataCategoryIndex':
            return {
                KeyConditionExpression: 'DataCategory = :keyId',
                keyId: props.DataCategory
            }
        default:
            return {
                KeyConditionExpression: 'EphemeraId = :keyId',
                keyId: props.EphemeraId
            }
    }    
}

export const abstractQueryExtended = <QueryInferredProps extends QueryExtendedProps & { IndexName?: string }>(dbClient: DynamoDBClient, table: string, extractKeyInfo: (props: QueryInferredProps) => ExtractKeyReturn) => async (props: QueryInferredProps) => {
    const {
        IndexName = '',
        ProjectionFields: passedProjectionFields,
        KeyConditionExpression: extraExpression,
        ExpressionAttributeNames = {},
        ExpressionAttributeValues,
        FilterExpression
    } = props
    return await asyncSuppressExceptions(async () => {
        const ProjectionFields = passedProjectionFields || 
            (IndexName
                ? [
                    table === assetsTable && 'AssetId',
                    table === ephemeraTable && 'EphemeraId',
                    table === messageTable && 'MessageId'
                ].filter((value) => (value)) 
                : ['DataCategory'])
        const { KeyConditionExpression: baseExpression, keyId } = extractKeyInfo(props)
        const KeyConditionExpression = extraExpression
            ? `${baseExpression} AND ${extraExpression}`
            : baseExpression
        const revisedExpressionAttributeNames = {
            ...ExpressionAttributeNames,
            ...(IndexName === 'ZoneIndex' ? { '#zone': 'zone' } : {})
        }
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: table,
            KeyConditionExpression,
            IndexName,
            ExpressionAttributeValues: marshall({
                ':keyId': keyId,
                ...(ExpressionAttributeValues || {})
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ExpressionAttributeNames: (Object.keys(revisedExpressionAttributeNames).length > 0)
                ? revisedExpressionAttributeNames
                : undefined,
            FilterExpression
        }))
        return {
            Items: Items.map((value) => (unmarshall(value)))
        }
    }, async () => ({ Items: [] }))
}

export const abstractQuery = <QueryInferredProps extends QueryExtendedProps & { IndexName?: string }>(dbClient: DynamoDBClient, table: string, extractKeyInfo: (props: QueryInferredProps) => ExtractKeyReturn) => async <T extends Record<string, any>[]>(props: QueryInferredProps): Promise<T> => {
    const { Items } = await abstractQueryExtended(dbClient, table, extractKeyInfo)(props) as { Items: T }
    return Items
}

export const assetsQueryFactory = (dbClient: DynamoDBClient): (<T extends Record<string, any>[]>(props: AssetQueryKeyProps & QueryExtendedProps) => Promise<T>) => (abstractQuery<AssetQueryKeyProps & QueryExtendedProps>(dbClient, assetsTable, assetExtractKeyInfo))
export const ephemeraQueryFactory = (dbClient: DynamoDBClient): (<T extends Record<string, any>[]>(props: EphemeraQueryKeyProps & QueryExtendedProps) => Promise<T>) => (abstractQuery<EphemeraQueryKeyProps & QueryExtendedProps>(dbClient, ephemeraTable, ephemeraExtractKeyInfo))
