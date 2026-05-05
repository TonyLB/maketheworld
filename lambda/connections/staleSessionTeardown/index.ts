// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { connectionDB, META_SESSION_PK, sessionMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'
import delayPromise from '@tonylb/mtw-utilities/ts/dynamoDB/delayPromise'
import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { atomicallyRemoveCharacterAdjacency } from '../disconnect'

export type TearDownSourceOperation = 'checkSession' | 'staleSessionFinding'

export type TearDownStaleSessionContext = {
    sourceOperation: TearDownSourceOperation
    /** If omitted, no player is included on problem reports (D3 allows empty/omitted). */
    player?: string
}

const libraryMapSessionIdsCleanup = (sessionId: string) => ([
    {
        Update: {
            Key: {
                ConnectionId: 'Library',
                DataCategory: 'Subscriptions'
            },
            updateKeys: ['SessionIds'],
            updateReducer: (draft: any) => {
                draft.SessionIds = (draft.SessionIds ?? []).filter((value: string) => (value !== sessionId))
            }
        }
    },
    {
        Update: {
            Key: {
                ConnectionId: 'Map',
                DataCategory: 'Subscriptions'
            },
            updateKeys: ['SessionIds'],
            updateReducer: (draft: any) => {
                draft.SessionIds = (draft.SessionIds ?? []).filter((value: string) => (value !== sessionId))
            }
        }
    }
])

const dynamoErrorType = (err: unknown): string => {
    if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>
        return String(e.name ?? e.code ?? e.errorType ?? 'unknown')
    }
    return 'unknown'
}

type RetryWithEscalationSuccess<T> = { ok: true; value: T; attempts: number }
type RetryWithEscalationFailure = { ok: false; attempts: number; lastError: unknown }

/**
 * Runs fn up to `maxAttempts` times. On retryable errors, waits using `backoffMs[attempt - 1]` before the next attempt.
 */
export const retryWithEscalation = async <T>(
    fn: (attempt: number) => Promise<T>,
    opts: { retryErrors: string[]; maxAttempts: number; backoffMs: number[] }
): Promise<RetryWithEscalationSuccess<T> | RetryWithEscalationFailure> => {
    const { retryErrors, maxAttempts, backoffMs } = opts
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const value = await fn(attempt)
            return { ok: true, value, attempts: attempt }
        }
        catch (err) {
            lastError = err
            const type = dynamoErrorType(err)
            const retryable = retryErrors.includes(type)
            if (attempt >= maxAttempts || !retryable) {
                return { ok: false, attempts: attempt, lastError: err }
            }
            const waitMs = backoffMs[attempt - 1] ?? 0
            if (waitMs > 0) {
                await delayPromise(waitMs)
            }
        }
    }
    return { ok: false, attempts: maxAttempts, lastError }
}

const logBookkeepingFailure = (args: {
    event: 'session-disconnect-bookkeeping-failed' | 'session-disconnect-bookkeeping-retry'
    sessionId: string
    player: string
    sourceOperation: TearDownSourceOperation
    attempt: number
    errorType: string
    dedupeKey: string
}) => {
    console.log(JSON.stringify(args))
}

/**
 * Idempotent cleanup for a session that is already scheduled to drop (e.g. `checkSession` with `shouldDrop`).
 * Emits `Session Disconnect` after character adjacency removal, then retries Library/Map `SessionIds` bookkeeping.
 * On bookkeeping failure, emits `Session Disconnect Problem` (D3/D4).
 */
export const tearDownStaleSession = async (
    sessionId: string,
    context: TearDownStaleSessionContext
): Promise<void> => {
    const { sourceOperation, player: contextPlayer } = context
    const player = typeof contextPlayer === 'string' ? contextPlayer.trim() : ''

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

    const attemptStartIso = new Date().toISOString()
    const dedupeKey = `${sourceOperation}:${sessionId}:${attemptStartIso}`

    const bookkeeping = await retryWithEscalation(
        async (attempt) => {
            try {
                await connectionDB.transactWrite([...libraryMapSessionIdsCleanup(sessionId)])
            }
            catch (err) {
                const errorType = dynamoErrorType(err)
                const retryable = errorType === 'TransactionCanceledException'
                if (retryable && attempt < 3) {
                    logBookkeepingFailure({
                        event: 'session-disconnect-bookkeeping-retry',
                        sessionId,
                        player,
                        sourceOperation,
                        attempt,
                        errorType,
                        dedupeKey
                    })
                }
                throw err
            }
            return true
        },
        {
            retryErrors: ['TransactionCanceledException'],
            maxAttempts: 3,
            backoffMs: [100, 200, 400]
        }
    )

    if (bookkeeping.ok) {
        return
    }

    const errorType = dynamoErrorType(bookkeeping.lastError)
    logBookkeepingFailure({
        event: 'session-disconnect-bookkeeping-failed',
        sessionId,
        player,
        sourceOperation,
        attempt: bookkeeping.attempts,
        errorType,
        dedupeKey
    })

    await eventBridgeClient.send([{
        DetailType: 'Session Disconnect Problem',
        Detail: {
            sessionId,
            ...(player ? { player } : {}),
            sourceOperation,
            attemptCount: bookkeeping.attempts,
            dedupeKey
        }
    }])
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
