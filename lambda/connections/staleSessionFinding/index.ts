// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export type StaleSessionIdFindingDetail = {
    player?: string
    diagnosticRunId?: string
    type?: string
    timestamp?: string
}

/**
 * EventBridge: `source: mtw.diagnostics`, `detail-type: Stale SessionId Finding`.
 * Repair logic (connections-table reconciliation per D6) lands in a follow-up slice; this handler is wiring-only.
 */
export const handleStaleSessionFinding = async (detail: StaleSessionIdFindingDetail): Promise<void> => {
    console.log(JSON.stringify({
        event: 'stale-session-finding-received-stub',
        player: detail.player,
        diagnosticRunId: detail.diagnosticRunId
    }))
}
