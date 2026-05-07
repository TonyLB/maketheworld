import { routeDiagnosticsIngress } from "./ingress"
import messageBus from "./messageBus"
import { extractReturnValue } from "./returnValue"

export const handler = async (event) => {
    messageBus.clear()

    if (
        (event?.source && event["detail-type"]) ||
        ['StaleSessionSweep', 'RoomOccupancyDriftSweep', 'PlayerMisalignmentSweep'].includes(event?.type)
    ) {
        await routeDiagnosticsIngress(event)
    }

    await messageBus.flush()
    return extractReturnValue(messageBus)
}
