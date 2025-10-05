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
// Note: This creates a generic subscription message that extends the current type system
const createStandardTransform = (dataSourceKey: string) => (event: any): SubscriptionClientMessage => {
    // For now, we'll create a message that matches the existing SubscriptionClientMessage structure
    // This will need to be extended in mtw-interfaces to support other DataSources
    return {
        messageType: 'Subscription' as const,
        dataSourceKey: dataSourceKey as any, // Type assertion for now
        streamKey: event.streamKey,
        update: event.update || event
    } as SubscriptionClientMessage
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
