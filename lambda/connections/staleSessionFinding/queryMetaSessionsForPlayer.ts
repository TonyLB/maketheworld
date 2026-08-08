// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
    connectionDB,
    META_SESSION_PK,
    playerSessionsPK,
    sessionIdFromMetaSortKey,
    sessionMetaSortKey
} from '@tonylb/mtw-utilities/ts/dynamoDB'

export type MetaSessionRow = {
    ConnectionId: string
    DataCategory: string
    connections?: string[]
    dropAfter?: number
    player?: string
}

/**
 * Resolves a player's session reverse-index pointers, then batch-fetches the pointed-to
 * `Meta::Session` rows. Replaces a full-partition scan with a player-scoped pointer query.
 */
export const queryMetaSessionRowsForPlayer = async (player: string): Promise<MetaSessionRow[]> => {
    const trimmedPlayer = player.trim()

    const pointers = await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
        Key: {
            ConnectionId: playerSessionsPK(trimmedPlayer)
        },
        ProjectionFields: ['DataCategory'],
        ConsistentRead: true
    })

    const sessionIds = [...new Set(
        (pointers || [])
            .map(({ DataCategory }) => sessionIdFromMetaSortKey(DataCategory))
            .filter((sessionId): sessionId is string => Boolean(sessionId))
    )]

    if (!sessionIds.length) {
        return []
    }

    return await connectionDB.getItems<MetaSessionRow>({
        Keys: sessionIds.map((sessionId) => ({
            ConnectionId: META_SESSION_PK,
            DataCategory: sessionMetaSortKey(sessionId)
        })),
        ProjectionFields: ['ConnectionId', 'DataCategory', 'connections', 'dropAfter', 'player'],
        ConsistentRead: true
    })
}
