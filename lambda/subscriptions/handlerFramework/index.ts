import { SubscriptionClientMessage } from "@tonylb/mtw-interfaces/ts/subscriptions";
import { SubscriptionHandler, SubscriptionLibrary } from "./baseClasses";

type LibraryEntry = {
    dataSourceKey: string;
    type?: string;
    detailExtract?: (event: Record<string, any>) => string;
    transform?: (event: Record<string, any>) => SubscriptionClientMessage;
}

export const subscriptionLibraryConstructor = (entries: LibraryEntry[]): SubscriptionLibrary => {
    return new SubscriptionLibrary({
        library: entries.map((entry) => (new SubscriptionHandler(entry)))
    })
}

// Standard transform function for consistent message format
// Now uses proper EventBridge-derived types
const createStandardTransform = (dataSourceKey: string) => (event: any): SubscriptionClientMessage => {
    return {
        messageType: 'Subscription' as const,
        dataSourceKey,
        streamKey: event.streamKey,
        update: event.update || event,
        RequestId: event.RequestId
    }
}

export const subscriptionLibrary = subscriptionLibraryConstructor([
    {
        dataSourceKey: 'mtw.wml',
        type: 'Merge Conflict',
        transform: (event) => ({
            messageType: 'Subscription',
            dataSourceKey: 'mtw.wml',
            streamKey: event.streamKey,
            update: {
                type: 'Merge Conflict',
                RequestId: event.RequestId
            }
        })
    },
    {
        dataSourceKey: 'mtw.wml',
        type: 'Content Update',
        transform: (event) => ({
            messageType: 'Subscription',
            dataSourceKey: 'mtw.wml',
            streamKey: event.streamKey,
            update: {
                type: 'Content Update',
                RequestId: event.RequestId,
                wml: event.schema    
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.contentHeaders',
        type: 'Content Headers Updated',
        transform: createStandardTransform('mtw.assets.contentHeaders')
    }
])
