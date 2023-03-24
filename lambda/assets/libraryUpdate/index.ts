import { apiClient } from "../clients"
import { LibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

export const libraryUpdateMessage = async ({ payloads, messageBus }: { payloads: LibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.Library.clear()
    const [Characters, Assets, ConnectionIds] = await Promise.all([
        internalCache.Library.get('Characters'),
        internalCache.Library.get('Assets'),
        internalCache.Connection.get('librarySubscriptions')
    ])
    await Promise.all((ConnectionIds || []).map((ConnectionId) => (
        apiClient.send({
            ConnectionId,
            Data: JSON.stringify({
                messageType: 'Library',
                Characters: Object.values(Characters),
                Assets: Object.values(Assets)
            })
        })
    )))
}

export default libraryUpdateMessage
