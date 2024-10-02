import { SubscriptionHandler } from "./baseClasses";

type LibraryEntry = {
    source: string;
}

const subscriptionLibraryConstructor = (entries: LibraryEntry[]): SubscriptionHandler[] => {
    return entries.map((entry) => (new SubscriptionHandler(entry)))
}

export const subscriptionLibrary = subscriptionLibraryConstructor([
    {
        source: 'pong'
    }
])
