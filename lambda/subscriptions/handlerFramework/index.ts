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

export const subscriptionLibrary = subscriptionLibraryConstructor([
    {
        dataSourceKey: 'mtw.wml',
        type: 'Merge Conflict',
        transform: (event) => ({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.wml',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
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
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.wml',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                type: 'Content Update',
                RequestId: event.RequestId,
                wml: event.schema    
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.contentHeaders',
        type: 'Headers Updated',
        transform: (event) => ({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.contentHeaders',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                type: 'Headers Updated',
                assetId: event.assetId,
                zone: event.zone,
                RequestId: event.RequestId,
                wml: event.schema
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.library',
        type: 'Asset Added',
        transform: (event) => ({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.library',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                type: 'Asset Added',
                assetId: event.assetId,
                RequestId: event.RequestId
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.library',
        type: 'Asset Removed',
        transform: (event) => ({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.library',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                type: 'Asset Removed',
                assetId: event.assetId,
                RequestId: event.RequestId
            }
        })
    },
    {
        dataSourceKey: 'mtw.assets.players',
        transform: (event) => ({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players',
            streamKey: event.streamKey,
            timestamp: event.timestamp,
            update: {
                ...event.update,
                ...(event.RequestId ? { RequestId: event.RequestId } : {})
            }
        })
    }
])
