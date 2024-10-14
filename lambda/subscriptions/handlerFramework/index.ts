import { SubscriptionClientMessage } from "@tonylb/mtw-interfaces/ts/subscriptions";
import { SubscriptionHandler, SubscriptionLibrary } from "./baseClasses";

type LibraryEntry = {
    source: string;
    detailType?: string;
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
        source: 'mtw.wml',
        detailType: 'Merge Conflict',
        detailExtract: (event) => (event.AssetId),
        transform: (event) => ({
            messageType: 'Subscription',
            source: 'mtw.wml',
            detailType: 'Merge Conflict',
            AssetId: event.AssetId,
            RequestId: event.RequestId
        })
    },
    {
        source: 'mtw.wml',
        detailType: 'Asset Edited',
        detailExtract: (event) => (event.AssetId),
        transform: (event) => ({
            messageType: 'Subscription',
            source: 'mtw.wml',
            detailType: 'Asset Edited',
            AssetId: event.AssetId,
            RequestId: event.RequestId,
            schema: event.schema
        })
    }
])
