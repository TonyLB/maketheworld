import { WMLContentEventExternal, isWMLContentEventExternal } from "./eventBridge/wml";
import { ContentHeadersExternal, isContentHeadersExternal } from "./eventBridge/assets/contentHeaders";

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

// Specific, strongly-typed subscription message types
export type WMLSubscriptionClientMessage = {
    messageType: 'Subscription';
    dataSourceKey: 'mtw.wml';
    streamKey: string;
    update: WMLContentEventExternal;
    RequestId?: string;
}

export type ContentHeadersSubscriptionClientMessage = {
    messageType: 'Subscription';
    dataSourceKey: 'mtw.assets.contentHeaders';
    streamKey: string;
    update: ContentHeadersExternal;
    RequestId?: string;
}

// Union of all subscription client messages
export type SubscriptionClientMessage =
    | WMLSubscriptionClientMessage
    | ContentHeadersSubscriptionClientMessage

// Type guard for subscription client messages
export const isSubscriptionClientMessage = (message: Record<string, any>): message is SubscriptionClientMessage => {
    if (!('messageType' in message && message.messageType === 'Subscription')) {
        return false
    }
    if (!('dataSourceKey' in message) || typeof message.dataSourceKey !== 'string') {
        return false
    }
    if (!('streamKey' in message) || typeof message.streamKey !== 'string') {
        return false
    }
    if (!('update' in message) || typeof message.update !== 'object') {
        return false
    }
    // Narrow per dataSourceKey
    switch(message.dataSourceKey) {
        case 'mtw.wml':
            return isWMLContentEventExternal(message.update)
        case 'mtw.assets.contentHeaders':
            return isContentHeadersExternal(message.update)
        default:
            return false
    }
}