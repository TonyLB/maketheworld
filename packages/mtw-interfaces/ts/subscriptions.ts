import { AssetUUID } from "@tonylb/mtw-base/ts/schema";
import { SubscriptionClientMessage as BaseSubscriptionClientMessage, EventPayload } from "./eventBridge/baseClasses";
import { WMLContentEventExternal } from "./eventBridge/wml";

export type SubscribeAPIMessage = Record<string, any> & {
    message: 'subscribe';
    dataSourceKey: string;
    type: string;
    streamKey?: string;
}

export type UnsubscribeAPIMessage = Record<string, any> & {
    message: 'unsubscribe';
    dataSourceKey: string;
    type: string;
    streamKey?: string;
}

export type SubscriptionsAPIMessage = SubscribeAPIMessage | UnsubscribeAPIMessage

export const isSubscribeAPIMessage = (message: SubscriptionsAPIMessage): message is SubscribeAPIMessage => (message.message === 'subscribe')
export const isUnsubscribeAPIMessage = (message: SubscriptionsAPIMessage): message is UnsubscribeAPIMessage => (message.message === 'unsubscribe')

export const isSubscriptionsAPIMessage = (message: Record<string, any>): message is SubscriptionsAPIMessage => {
    if (!('message' in message)) {
        return false
    }
    switch(message.message) {
        case 'subscribe':
        case 'unsubscribe':
            return ('dataSourceKey' in message)
                && typeof message.dataSourceKey === 'string'
                && (!('type' in message) || typeof message.type === 'undefined' || typeof message.type === 'string')
        default: return false
    }
}

// EventBridge-derived subscription message types
export type WMLSubscriptionClientMessage = BaseSubscriptionClientMessage<WMLContentEventExternal>

// Union of all subscription message types
export type SubscriptionClientMessage = WMLSubscriptionClientMessage

// Re-export the generic type guard from base classes
export { isSubscriptionClientMessage } from "./eventBridge/baseClasses"