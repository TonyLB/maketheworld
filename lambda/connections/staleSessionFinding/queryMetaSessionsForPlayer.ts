// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { connectionDB, META_SESSION_PK } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { QueryPageEnvelope } from '@tonylb/mtw-utilities/ts/dynamoDB/mixins/query'

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
    const trimmedPlayer = player.trim()
    const collected: MetaSessionRow[] = []
    let nextPage: (() => Promise<QueryPageEnvelope<MetaSessionRow>>) | undefined

    const queryPage = async (continuationToken?: string) => (
        await connectionDB.query<MetaSessionRow>({
            Key: {
                ConnectionId: META_SESSION_PK
            },
            KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
            ExpressionAttributeValues: {
                ':prefix': 'SESSION#'
            },
            ProjectionFields: ['ConnectionId', 'DataCategory', 'connections', 'dropAfter', 'player'],
            ConsistentRead: true,
            pagination: continuationToken ? { nextToken: continuationToken } : true
        })
    )

    let page = await queryPage()
    do {
        const batch = page.items
        for (const row of batch) {
            const rowPlayer = typeof row.player === 'string' ? row.player.trim() : ''
            if (rowPlayer === trimmedPlayer) {
                collected.push(row)
            }
        }
        nextPage = page.nextPage
        if (nextPage) {
            page = await nextPage()
        }
    } while (nextPage)

    return collected
}
