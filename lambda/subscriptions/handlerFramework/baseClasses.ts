import { isSubscriptionsAPIMessage, isSubscribeAPIMessage, SubscribeAPIMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'

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
    
    isSubscribe(event: Record<string, any>): boolean {
        return isSubscriptionsAPIMessage(event) && isSubscribeAPIMessage(event)
    }

    async subscribe(message: SubscribeAPIMessage): Promise<void> {
        
    }
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