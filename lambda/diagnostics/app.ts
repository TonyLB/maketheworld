import { routeDiagnosticsIngress } from "./ingress"
import internalCache from "./internalCache"
import messageBus from "./messageBus"
import { extractReturnValue } from "./returnValue"

export const handler = async (event) => {
    internalCache.clear()
    messageBus.clear()

    if (
        (event?.source && event["detail-type"]) ||
        [
            'StaleSessionSweep',
            'RoomOccupancyDriftSweep',
            'PlayerMisalignmentSweep',
            'ComponentVerticalMisalignmentSweep',
            'RenderCacheDriftSweep',
            'OrphanedImprovisedObjectSweep',
            'LudicGraphStaleStructureSweep',
        ].includes(event?.type)
    ) {
        await routeDiagnosticsIngress(event)
    }

    await messageBus.flushAndSettle()
    return extractReturnValue(messageBus)
}
