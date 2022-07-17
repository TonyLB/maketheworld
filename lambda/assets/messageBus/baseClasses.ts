import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}

export type MessageType = ReturnValueMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')

export class MessageBus extends InternalMessageBus<MessageType> {}
