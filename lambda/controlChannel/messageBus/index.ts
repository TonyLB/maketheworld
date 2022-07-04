import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import {
    MessageBus,
    isPublishMessage,
    isEphemeraUpdate,
    isDisconnectMessage,
    isConnectMessage,
    isWhoAmIMessage,
    isSyncRequest,
    isSyncResponse,
    isRegisterCharacterMessage,
    isFetchPlayerEphemera
} from "./baseClasses"

import publishMessage from '../publishMessage'
import ephemeraUpdate from '../ephemeraUpdate'
import disconnectMessage from '../disconnectMessage'
import connectMessage from '../connectMessage'
import whoAmIMessage from '../whoAmI'
import { syncRequest, syncResponse } from '../syncHandler'
import registerCharacter from '../registerCharacter'
import { fetchPlayerEphemera } from '../fetchEphemera'

export const messageBus = new MessageBus()
messageBus.subscribe({
    tag: 'PublishMessage',
    priority: 5,
    filter: isPublishMessage,
    callback: publishMessage
})
messageBus.subscribe({
    tag: 'EphemeraUpdate',
    priority: 5,
    filter: isEphemeraUpdate,
    callback: ephemeraUpdate
})
messageBus.subscribe({
    tag: 'Disconnect',
    priority: 1,
    filter: isDisconnectMessage,
    callback: disconnectMessage
})
messageBus.subscribe({
    tag: 'Connect',
    priority: 1,
    filter: isConnectMessage,
    callback: connectMessage
})
messageBus.subscribe({
    tag: 'WhoAmI',
    priority: 1,
    filter: isWhoAmIMessage,
    callback: whoAmIMessage
})
messageBus.subscribe({
    tag: 'SyncResponse',
    priority: 2,
    filter: isSyncResponse,
    callback: syncResponse
})
messageBus.subscribe({
    tag: 'SyncRequest',
    priority: 3,
    filter: isSyncRequest,
    callback: syncRequest
})
messageBus.subscribe({
    tag: 'RegisterCharacter',
    priority: 1,
    filter: isRegisterCharacterMessage,
    callback: registerCharacter
})
messageBus.subscribe({
    tag: 'FetchPlayerEphemera',
    priority: 2,
    filter: isFetchPlayerEphemera,
    callback: fetchPlayerEphemera
})

export default messageBus