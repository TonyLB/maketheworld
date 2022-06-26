import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

import { MessageType } from "./baseClasses"

export default class MessageBus extends InternalMessageBus<MessageType> {}
