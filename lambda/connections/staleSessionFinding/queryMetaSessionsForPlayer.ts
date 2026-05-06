// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { META_SESSION_PK } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'

export type MetaSessionRow = {
    ConnectionId: string
    DataCategory: string
    connections?: string[]
    dropAfter?: number
    player?: string
}

/**
 * Paginates `Meta::Session` rows and returns those whose `player` matches (trimmed equality).
 */
export const queryMetaSessionRowsForPlayer = async (player: string): Promise<MetaSessionRow[]> => {
    const tablePrefix = process.env.TABLE_PREFIX
    if (!tablePrefix) {
        throw new Error('queryMetaSessionRowsForPlayer requires TABLE_PREFIX')
    }
    const region = process.env.AWS_REGION
    if (!region) {
        throw new Error('queryMetaSessionRowsForPlayer requires AWS_REGION')
    }

    const trimmedPlayer = player.trim()
    const client = new DynamoDBClient({ region })
    const tableName = `${tablePrefix}_connections`
    const collected: MetaSessionRow[] = []
    let exclusiveStartKey: Record<string, AttributeValue> | undefined

    do {
        const out = await client.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'ConnectionId = :pk AND begins_with(DataCategory, :prefix)',
            ExpressionAttributeValues: marshall({
                ':pk': META_SESSION_PK,
                ':prefix': 'SESSION#'
            }),
            ConsistentRead: true,
            ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
        }))
        const batch = (out.Items ?? []).map((item) => unmarshall(item) as MetaSessionRow)
        for (const row of batch) {
            const rowPlayer = typeof row.player === 'string' ? row.player.trim() : ''
            if (rowPlayer === trimmedPlayer) {
                collected.push(row)
            }
        }
        exclusiveStartKey = out.LastEvaluatedKey
    } while (exclusiveStartKey)

    return collected
}
