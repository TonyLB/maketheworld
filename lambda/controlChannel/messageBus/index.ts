import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import { MessageType, isPublishMessage, isReturnValueMessage } from "./baseClasses"

import publishMessage from '../publishMessage'
import returnValueMessage from '../returnValue'

export default class MessageBus extends InternalMessageBus<MessageType> {
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
    }
}
