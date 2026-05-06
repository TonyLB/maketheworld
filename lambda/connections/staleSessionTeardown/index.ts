// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { connectionDB, META_SESSION_PK, sessionMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { atomicallyRemoveCharacterAdjacency } from '../disconnect'

export type TearDownSourceOperation = 'checkSession' | 'staleSessionFinding'

export type TearDownStaleSessionContext = {
    sourceOperation: TearDownSourceOperation
    player?: string
}

/**
 * Idempotent cleanup for a session that is already scheduled to drop (e.g. `checkSession` with `shouldDrop`).
 * Emits `Session Disconnect` after character adjacency removal, then removes the `Meta::Session` row.
 * PR8 intentionally removes legacy Map-subscription bookkeeping from this path.
 */
export const tearDownStaleSession = async (
    sessionId: string,
    context: TearDownStaleSessionContext
): Promise<void> => {
    const { sourceOperation } = context
    void sourceOperation

    const characterQuery = await connectionDB.query<{ ConnectionId: string; DataCategory: EphemeraCharacterId }>({
        Key: { ConnectionId: `SESSION#${sessionId}` },
        ExpressionAttributeValues: {
            ':dcPrefix': 'CHARACTER#'
        },
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ProjectionFields: ['DataCategory']
    })

    await Promise.all(characterQuery.map(({ DataCategory }) => (atomicallyRemoveCharacterAdjacency(sessionId, DataCategory))))

    await eventBridgeClient.send([{
        DetailType: 'Session Disconnect',
        Detail: { sessionId }
    }])
    await connectionDB.deleteItem({
        ConnectionId: META_SESSION_PK,
        DataCategory: sessionMetaSortKey(sessionId)
    })
}

/**
 * Read `player` from the session meta row before it may be deleted by `checkSession` optimistic update.
 */
export const getSessionPlayerForTeardown = async (sessionId: string): Promise<string> => {
    const row = await connectionDB.getItem<{ player?: string }>({
        Key: {
            ConnectionId: META_SESSION_PK,
            DataCategory: sessionMetaSortKey(sessionId)
        },
        ProjectionFields: ['player']
    })
    return typeof row?.player === 'string' ? row.player.trim() : ''
}
