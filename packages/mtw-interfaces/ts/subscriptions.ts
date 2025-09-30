import { AssetUUID } from "@tonylb/mtw-base/ts/schema";
import { AssetWorkspaceAddress } from "./baseClasses";

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

export type SubscriptionClientMergeConflictMessage = {
    dataSourceKey: 'mtw.wml';
    streamKey: AssetUUID;
    update: {
        type: 'Merge Conflict';
        RequestId: string;
    }
}

export type SubscriptionClientAssetEditedMessage = {
    dataSourceKey: 'mtw.wml';
    streamKey: AssetUUID;
    update: {
        type: 'Content Update';
        RequestId: string;
        wml: string;
    }
}

export type SubscriptionClientMessage = { messageType: 'Subscription' } & (
    SubscriptionClientMergeConflictMessage |
    SubscriptionClientAssetEditedMessage
)

export const isSubscriptionClientMessage = (message: Record<string, any>): message is SubscriptionClientMessage => {
    if (!('messageType' in message && message.messageType === 'Subscription')) {
        return false
    }
    return true
}