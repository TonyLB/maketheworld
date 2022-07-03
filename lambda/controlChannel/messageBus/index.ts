import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import {
    MessageType,
    isPublishMessage,
    isReturnValueMessage,
    isDisconnectMessage,
    isConnectMessage,
    isWhoAmIMessage,
    isSyncRequest,
    isSyncResponse
} from "./baseClasses"

import publishMessage from '../publishMessage'
import returnValueMessage from '../returnValue'
import disconnectMessage from '../disconnectMessage'
import connectMessage from '../connectMessage'
import whoAmIMessage from '../whoAmI'
import { syncRequest, syncResponse } from '../syncHandler'

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
    }
}

export const messageBus = new MessageBus()
export default messageBus