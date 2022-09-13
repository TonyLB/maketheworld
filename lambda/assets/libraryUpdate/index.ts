import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'
import { LibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'

export const libraryUpdateMessage = async ({ payloads, messageBus }: { payloads: LibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.Library.clear()
    const [Characters, Assets, connectionFetch] = await Promise.all([
        internalCache.Library.get('Characters'),
        internalCache.Library.get('Assets'),
        connectionDB.getItem<{ ConnectionIds: string[] }>({
            ConnectionId: 'Library',
            DataCategory: 'Subscriptions',
            ProjectionFields: ['ConnectionIds']
        })
    ])
    const { ConnectionIds = [] } = connectionFetch || {}
    await Promise.all(ConnectionIds.map((ConnectionId) => (
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
