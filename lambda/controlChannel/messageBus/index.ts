import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import { MessageType, isPublishMessage, isReturnValueMessage, isDisconnectMessage } from "./baseClasses"

import publishMessage from '../publishMessage'
import returnValueMessage from '../returnValue'
import disconnectMessage from '../disconnectMessage'

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
            tag: 'ReturnValue',
            priority: 10,
            filter: isReturnValueMessage,
            callback: returnValueMessage
        })
        this.subscribe({
            tag: 'Disconnect',
            priority: 1,
            filter: isDisconnectMessage,
            callback: disconnectMessage
        })
    }
}

export const messageBus = new MessageBus()
export default messageBus