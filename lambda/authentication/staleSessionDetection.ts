// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Stale `Meta::Session` classification for connect-time detection (Phase 4).
 *
 * These predicates **must** stay aligned with
 * [`lambda/connections/staleSessionFinding/classification.ts`](../connections/staleSessionFinding/classification.ts)
 * and [`lambda/diagnostics/staleSessionSweep/classification.ts`](../diagnostics/staleSessionSweep/classification.ts).
 * When changing any of the three, update the other two and run all three lambdas' tests. Duplicated
 * (rather than shared via `packages/`) because each lambda bundles independently and does not import
 * across `lambda/*` folders.
 */

import { connectionDB, META_SESSION_PK, playerSessionsPK, sessionIdFromMetaSortKey, sessionMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'

const STALE_BUFFER_MS = 12_000

const hasActiveConnections = (connections?: string[]): boolean =>
    Array.isArray(connections) && connections.length > 0

const isStaleSessionMetaRow = (args: {
    connections?: string[]
    dropAfter?: number
    nowMs: number
}): boolean => {
    const { connections, dropAfter, nowMs } = args
    if (hasActiveConnections(connections)) {
        return false
    }
    if (typeof dropAfter !== 'number') {
        return true
    }
    return nowMs > dropAfter + STALE_BUFFER_MS
}

type MetaSessionRow = {
    ConnectionId: string
    DataCategory: string
    connections?: string[]
    dropAfter?: number
}

/**
 * Resolves the connecting player's *other* sessions via the reverse-index pointer partition and
 * returns the ones that are stale (past `STALE_BUFFER_MS` with no active connections). The session
 * being connected to is always excluded, even if its own row would otherwise classify as stale.
 */
export const detectStaleSessionsForPlayer = async (
    player: string,
    excludeSessionId: string,
    nowMs: number = Date.now()
): Promise<string[]> => {
    const pointers = await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
        Key: {
            ConnectionId: playerSessionsPK(player)
        },
        ProjectionFields: ['DataCategory'],
        ConsistentRead: true
    })

    const sessionIds = [...new Set(
        (pointers || [])
            .map(({ DataCategory }) => sessionIdFromMetaSortKey(DataCategory))
            .filter((sessionId): sessionId is string => Boolean(sessionId))
    )].filter((sessionId) => sessionId !== excludeSessionId)

    if (!sessionIds.length) {
        return []
    }

    const rows = await connectionDB.getItems<MetaSessionRow>({
        Keys: sessionIds.map((sessionId) => ({
            ConnectionId: META_SESSION_PK,
            DataCategory: sessionMetaSortKey(sessionId)
        })),
        ProjectionFields: ['ConnectionId', 'DataCategory', 'connections', 'dropAfter'],
        ConsistentRead: true
    })

    return rows
        .map((row) => sessionIdFromMetaSortKey(row.DataCategory))
        .filter((sessionId, index): sessionId is string => {
            if (!sessionId) {
                return false
            }
            return isStaleSessionMetaRow({
                connections: rows[index].connections,
                dropAfter: rows[index].dropAfter,
                nowMs
            })
        })
}
