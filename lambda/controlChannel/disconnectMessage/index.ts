import { DisconnectMessage, MessageBus } from "../messageBus/baseClasses"

import { forceDisconnect } from '@tonylb/mtw-utilities/dist/apiManagement/forceDisconnect'

export const disconnectMessage = async ({ payloads }: { payloads: DisconnectMessage[], messageBus?: MessageBus }): Promise<void> => {
    //
    // TODO: Figure out whether a forced disconnet invalidates any cached values
    //

    await Promise.all(payloads.map(async (payload) => (
        forceDisconnect(payload.connectionId)
    )))
}

export default disconnectMessage
