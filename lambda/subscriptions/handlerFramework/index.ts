import { SubscriptionHandler, SubscriptionLibrary } from "./baseClasses";

type LibraryEntry = {
    source: string;
    detailType?: string;
    detailExtract?: (event: Record<string, any>) => string;
}

export const subscriptionLibraryConstructor = (entries: LibraryEntry[]): SubscriptionLibrary => {
    return new SubscriptionLibrary({
        library: entries.map((entry) => (new SubscriptionHandler(entry)))
    })
}

export const subscriptionLibrary = subscriptionLibraryConstructor([
    {
        source: 'pong'
    },
    {
        source: 'mtw.wml',
        detailType: 'Merge Conflict',
        detailExtract: (event) => (event.AssetId)
    }
])
