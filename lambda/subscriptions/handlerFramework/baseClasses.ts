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
}