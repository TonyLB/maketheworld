import { SubscriptionHandler, SubscriptionLibrary } from "./baseClasses";

type LibraryEntry = {
    source: string;
}

const subscriptionLibraryConstructor = (entries: LibraryEntry[]): SubscriptionLibrary => {
    return new SubscriptionLibrary({
        library: entries.map((entry) => (new SubscriptionHandler(entry)))
    })
}

export const subscriptionLibrary = subscriptionLibraryConstructor([
    {
        source: 'pong'
    }
])
