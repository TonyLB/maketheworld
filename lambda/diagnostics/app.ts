import { healPlayer } from "./player"
import { staleSessionSweep } from "./staleSessionSweep"

export const handler = async (event) => {

    //
    // Handle EventBridge messages
    //
    if (event?.source === 'mtw.connections' && event["detail-type"] === 'New Player' && event.detail?.player) {
        return await healPlayer(event.detail?.player)
    }

    if (event?.source === 'mtw.diagnostics' && event["detail-type"] === 'Stale Session Sweep') {
        return await staleSessionSweep({
            diagnosticRunId: typeof event.detail?.diagnosticRunId === 'string' ? event.detail.diagnosticRunId : undefined
        })
    }

    //
    // Handle direct calls (e.g. step functions)
    //
    switch(event.type) {
        case 'HealPlayer':
            return await healPlayer(event.player)
        case 'StaleSessionSweep':
            return await staleSessionSweep({
                diagnosticRunId: typeof event.diagnosticRunId === 'string' ? event.diagnosticRunId : undefined,
                nowMs: typeof event.nowMs === 'number' ? event.nowMs : undefined
            })
    }
}
