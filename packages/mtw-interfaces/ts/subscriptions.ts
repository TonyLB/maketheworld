import { WMLContentEventExternal, isWMLContentEventExternal } from "./eventBridge/wml";
import { ContentHeadersExternal, isContentHeadersExternal } from "./eventBridge/assets/contentHeaders";
import { LibraryExternal, isLibraryExternal } from "./eventBridge/assets/library";
import { PlayerExternal, isPlayerExternal } from "./eventBridge/assets/players";

export type SubscribeAPIMessage = Record<string, any> & {
    message: 'subscribe';
    dataSourceKey: string;
    streamKeys: string[];  // Array of stream keys to subscribe to
}

export type UnsubscribeAPIMessage = Record<string, any> & {
    message: 'unsubscribe';
    dataSourceKey: string;
    streamKeys: string[];  // Array of stream keys to unsubscribe from
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
                && ('streamKeys' in message)
                && Array.isArray(message.streamKeys)
                && message.streamKeys.every((key: any) => typeof key === 'string')
        default: return false
    }
}

// Specific, strongly-typed subscription message types (StreamEvent)
export type WMLSubscriptionClientMessage = {
    messageType: 'StreamEvent';
    dataSourceKey: 'mtw.wml';
    streamKey: string;
    timestamp: number;
    update: WMLContentEventExternal;
    RequestId?: string;
}

export type ContentHeadersSubscriptionClientMessage = {
    messageType: 'StreamEvent';
    dataSourceKey: 'mtw.assets.contentHeaders';
    streamKey: string;
    timestamp: number;
    update: ContentHeadersExternal;
    RequestId?: string;
}

export type LibrarySubscriptionClientMessage = {
    messageType: 'StreamEvent';
    dataSourceKey: 'mtw.assets.library';
    streamKey: string;
    timestamp: number;
    update: LibraryExternal;
    RequestId?: string;
}

export type PlayerSubscriptionClientMessage = {
    messageType: 'StreamEvent';
    dataSourceKey: 'mtw.assets.players';
    streamKey: string;
    timestamp: number;
    update: PlayerExternal;
    RequestId?: string;
}

// Union of all subscription client messages
export type SubscriptionClientMessage =
    | WMLSubscriptionClientMessage
    | ContentHeadersSubscriptionClientMessage
    | LibrarySubscriptionClientMessage
    | PlayerSubscriptionClientMessage

// Type guard for subscription client messages (StreamEvent)
export const isSubscriptionClientMessage = (message: Record<string, any>): message is SubscriptionClientMessage => {
    if (!('messageType' in message && message.messageType === 'StreamEvent')) {
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
        case 'mtw.assets.library':
            return isLibraryExternal(message.update)
        case 'mtw.assets.players':
            return isPlayerExternal(message.update)
        default:
            return false
    }
}