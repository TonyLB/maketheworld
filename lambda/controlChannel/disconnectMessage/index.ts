import { DisconnectMessage, MessageBus } from "../messageBus/baseClasses"

import { forceDisconnect } from '@tonylb/mtw-utilities/dist/apiManagement/forceDisconnect'

//
// TODO:
//    - Remove Meta::Connection record
//    - Remove all Character adjacency records using transactions to atomically update Meta::Character item
//    - Update Library subscriptions
//    - Update Global connections
//    - Update activeCharacters in current room for Meta::Character items that were removed
//

const atomicallyRemoveCharacterAdjacency = async (connectionId, characterId) => {
    //
    // TODO: Abstract repeated attempts (with exponential backoff) at a try clause, and use
    // that abstraction here
    //
}

export const disconnectMessage = async ({ payloads }: { payloads: DisconnectMessage[], messageBus?: MessageBus }): Promise<void> => {
    //
    // TODO: Figure out whether a forced disconnet invalidates any cached values
    //

    await Promise.all(payloads.map(async (payload) => (
        forceDisconnect(payload.connectionId)
    )))
}

export default disconnectMessage
