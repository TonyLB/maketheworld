import { healPlayer } from "./player"
import { staleSessionSweep } from "./staleSessionSweep"
import { roomOccupancyDriftSweep } from "./roomOccupancyDriftSweep"
import { routeDiagnosticsIngress } from "./ingress"
import messageBus from "./messageBus"

export const handler = async (event) => {

    //
    // EventBridge diagnostics/problem-report intake goes through the DataSource lane.
    //
    if (event?.source && event["detail-type"]) {
        messageBus.clear()
        await routeDiagnosticsIngress(event)
        await messageBus.flush()
        return
    }

    //
    // Handle direct calls (e.g. step functions)
    //
    switch(event.type) {
        case 'HealPlayer':
            return await healPlayer(event.player)
        case 'StaleSessionSweep':
            messageBus.clear()
            await routeDiagnosticsIngress(event)
            await messageBus.flush()
            return
        case 'RoomOccupancyDriftSweep':
            return await roomOccupancyDriftSweep({
                diagnosticRunId: typeof event.diagnosticRunId === 'string' ? event.diagnosticRunId : undefined,
                nowMs: typeof event.nowMs === 'number' ? event.nowMs : undefined
            })
    }
}
