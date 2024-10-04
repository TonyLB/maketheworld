export class SubscriptionEvent {
    _source: string;
    constructor(args: {
        source: string;
    }) {
        this._source = args.source
    }
}

export class SubscriptionHandler {
    _source: string;
    constructor(args: {
        source: string;

    }) {
        this._source = args.source
    }

    match(event: Record<string, any>): SubscriptionEvent | undefined {
        if ("source" in event && event.source === this._source) {
            return new SubscriptionEvent(event as { source: string })
        }
        return
    }
    
    //
    // TODO: Once mtw-interfaces typeguard exists, create a typeguarded
    // *isSubscribe* method to this class that tells whether an incoming
    // request is a subscription for the chosen handler
    //

    //
    // TODO: After isSubscribe, create a *subscribe* method that adds
    // the relevant entries to the connections table
    //
}

export class SubscriptionLibrary {
    _library: SubscriptionHandler[];

    constructor(args: {
        library: SubscriptionHandler[]
    }) {
        this._library = args.library
    }

    match(event: Record<string, any>): SubscriptionEvent | undefined {
        return this._library.reduce<SubscriptionEvent | undefined>((previous, handler) => {
            return previous ?? handler.match(event)
        }, undefined)
    }
}