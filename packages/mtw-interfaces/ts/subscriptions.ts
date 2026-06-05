import type { WebSocketFormat } from "@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform";
import { WMLContentEventExternal, isWMLContentEventExternal } from "./eventBridge/wml";
import { ContentHeadersExternal, isContentHeadersExternal } from "./eventBridge/assets/contentHeaders";
import { LibraryExternal, isLibraryExternal } from "./eventBridge/assets/library";
import { PlayerExternal, isPlayerExternal } from "./eventBridge/assets/players";
import {
    ThinkingSchedulingExternal,
    isThinkingSchedulingExternal
} from "./eventBridge/ephemera/thinking";

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

// Subscription client message types extend the flat WebSocket base from patterns (domain union here).
// Stream correlation ids are extended-header fields merged to the WebSocket top level (not in update payload).
// See packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md (Stream correlation ids).

/** mtw.wml: plural RequestIds in header. Non-empty only when applyEdit resolution confirms client pending edits. */
export type WMLSubscriptionClientMessage = WebSocketFormat & {
    dataSourceKey: 'mtw.wml';
    update: WMLContentEventExternal;
    RequestIds?: string[];
};

/** mtw.assets.contentHeaders: singular RequestId reserved; producers omit until wired. */
export type ContentHeadersSubscriptionClientMessage = WebSocketFormat & {
    dataSourceKey: 'mtw.assets.contentHeaders';
    update: ContentHeadersExternal;
    RequestId?: string;
};

/** mtw.assets.library: singular RequestId reserved; producers omit until wired. */
export type LibrarySubscriptionClientMessage = WebSocketFormat & {
    dataSourceKey: 'mtw.assets.library';
    update: LibraryExternal;
    RequestId?: string;
};

/** mtw.assets.players: singular RequestId reserved; producers omit until wired. */
export type PlayerSubscriptionClientMessage = WebSocketFormat & {
    dataSourceKey: 'mtw.assets.players';
    update: PlayerExternal;
    RequestId?: string;
};

/** mtw.ephemera.thinking.scheduling: singular RequestId reserved; Job Completed omits today. */
export type ThinkingSchedulingSubscriptionClientMessage = WebSocketFormat & {
    dataSourceKey: 'mtw.ephemera.thinking.scheduling';
    update: ThinkingSchedulingExternal;
    RequestId?: string;
};

// Union of all subscription client messages
export type SubscriptionClientMessage =
    | WMLSubscriptionClientMessage
    | ContentHeadersSubscriptionClientMessage
    | LibrarySubscriptionClientMessage
    | PlayerSubscriptionClientMessage
    | ThinkingSchedulingSubscriptionClientMessage

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
        case 'mtw.ephemera.thinking.scheduling':
            return isThinkingSchedulingExternal(message.update)
        default:
            return false
    }
}

// Type guards for specific subscription client message types
export const isPlayerSubscriptionClientMessage = (message: SubscriptionClientMessage): message is PlayerSubscriptionClientMessage => (
    message.dataSourceKey === 'mtw.assets.players'
)