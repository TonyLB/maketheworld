// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { sessionIdFromMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { tearDownStaleSession } from '../staleSessionTeardown'
import { isStaleSessionMetaRow } from './classification'
import { queryMetaSessionRowsForPlayer } from './queryMetaSessionsForPlayer'

export type StaleSessionIdFindingDetail = {
    player?: string
    diagnosticRunId?: string
    type?: string
    timestamp?: string
}

/**
 * EventBridge: `source: mtw.diagnostics`, `detail-type: Stale SessionId Finding`.
 * Connections-table reconciliation per D6; bookkeeping failures on this path do not emit `Session Disconnect Problem`.
 */
export const handleStaleSessionFinding = async (detail: StaleSessionIdFindingDetail): Promise<void> => {
    const player = typeof detail.player === 'string' ? detail.player.trim() : ''
    if (!player) {
        console.log(JSON.stringify({
            event: 'stale-session-finding-skipped',
            reason: 'missing-player',
            diagnosticRunId: detail.diagnosticRunId
        }))
        return
    }

    const nowMs = Date.now()
    const rows = await queryMetaSessionRowsForPlayer(player)

    for (const row of rows) {
        const sessionId = sessionIdFromMetaSortKey(row.DataCategory)
        if (!sessionId) {
            continue
        }
        if (!isStaleSessionMetaRow({
            connections: row.connections,
            dropAfter: row.dropAfter,
            nowMs
        })) {
            continue
        }

        await tearDownStaleSession(sessionId, { sourceOperation: 'staleSessionFinding', player })
    }
}
