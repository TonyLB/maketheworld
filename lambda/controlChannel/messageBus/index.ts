import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import { MessageType, isPublishMessage } from "./baseClasses"

import publishMessage from '../publishMessage'

export default class MessageBus extends InternalMessageBus<MessageType> {
    constructor() {
        super()
        this.subscribe({
            tag: 'PublishMessage',
            priority: 5,
            filter: isPublishMessage,
            callback: publishMessage
        })
    }
}
