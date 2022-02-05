import {
    QueryCommand,
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { asyncSuppressExceptions } from '../errors.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`
const messageTable = `${TABLE_PREFIX}_messages`
const deltaTable = `${TABLE_PREFIX}_message_delta`

const extractKeyInfo = (table, indexName, {
    AssetId,
    EphemeraId,
    MessageId,
    DataCategory,
    player,
    scopedId
}) => {
    if (indexName) {
        switch(indexName) {
            case 'DataCategoryIndex':
                return {
                    KeyConditionExpression: 'DataCategory = :keyId',
                    keyId: DataCategory
                }
            case 'PlayerIndex':
                return {
                    KeyConditionExpression: 'player = :keyId',
                    keyId: player
                }
            case 'ScopedIdIndex':
                return {
                    KeyConditionExpression: 'scopedId = :keyId',
                    keyId: scopedId
                }
        }    
    }
    else {
        switch(table) {
            case messageTable:
                return {
                    KeyConditionExpression: 'MessageId = :keyId',
                    keyId: MessageId,
                }
            case ephemeraTable:
                return {
                    KeyConditionExpression: 'EphemeraId = :keyId',
                    keyId: EphemeraId,
                }
            default:
                return {
                    KeyConditionExpression: 'AssetId = :keyId',
                    keyId: AssetId,
                }
        }
    }
}

export const abstractQueryExtended = (dbClient, table) => async (props) => {
    const {
        IndexName,
        ProjectionFields: passedProjectionFields,
        KeyConditionExpression: extraExpression,
        ExpressionAttributeNames,
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
        const { KeyConditionExpression: baseExpression, keyId } = extractKeyInfo(
            table,
            IndexName,
            props
        )
        const KeyConditionExpression = extraExpression
            ? `${baseExpression} AND ${extraExpression}`
            : baseExpression
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: table,
            KeyConditionExpression,
            IndexName,
            ExpressionAttributeValues: marshall({
                ':keyId': keyId,
                ...(ExpressionAttributeValues || {})
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ExpressionAttributeNames,
            FilterExpression
        }))
        return {
            Items: Items.map(unmarshall)
        }
    }, () => ({ Items: [] }))
}

export const abstractQuery = (dbClient, table) => async (props) => {
    const { Items } = await abstractQueryExtended(dbClient, table)(props)
    return Items
}