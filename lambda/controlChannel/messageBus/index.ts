import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import {
    MessageType,
    isPublishMessage,
    isEphemeraUpdate,
    isDisconnectMessage,
    isConnectMessage,
    isWhoAmIMessage,
    isSyncRequest,
    isSyncResponse,
    isRegisterCharacterMessage
} from "./baseClasses"

import publishMessage from '../publishMessage'
import ephemeraUpdate from '../ephemeraUpdate'
import disconnectMessage from '../disconnectMessage'
import connectMessage from '../connectMessage'
import whoAmIMessage from '../whoAmI'
import { syncRequest, syncResponse } from '../syncHandler'
import registerCharacter from '../registerCharacter'

export class MessageBus extends InternalMessageBus<MessageType> {
    constructor() {
        super()
        this.subscribe({
            tag: 'PublishMessage',
            priority: 5,
            filter: isPublishMessage,
            callback: publishMessage
        })
        this.subscribe({
            tag: 'EphemeraUpdate',
            priority: 5,
            filter: isEphemeraUpdate,
            callback: ephemeraUpdate
        })
        this.subscribe({
            tag: 'Disconnect',
            priority: 1,
            filter: isDisconnectMessage,
            callback: disconnectMessage
        })
        this.subscribe({
            tag: 'Connect',
            priority: 1,
            filter: isConnectMessage,
            callback: connectMessage
        })
        this.subscribe({
            tag: 'WhoAmI',
            priority: 1,
            filter: isWhoAmIMessage,
            callback: whoAmIMessage
        })
        this.subscribe({
            tag: 'SyncResponse',
            priority: 2,
            filter: isSyncResponse,
            callback: syncResponse
        })
        this.subscribe({
            tag: 'SyncRequest',
            priority: 3,
            filter: isSyncRequest,
            callback: syncRequest
        })
        this.subscribe({
            tag: 'RegisterCharacter',
            priority: 1,
            filter: isRegisterCharacterMessage,
            callback: registerCharacter
        })
    }
}

export const messageBus = new MessageBus()
export default messageBus