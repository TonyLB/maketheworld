import { isSubscriptionsAPIMessage, isSubscribeAPIMessage, SubscribeAPIMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists';
import internalCache from '../internalCache';
import { apiClient } from '../apiClient';

export class SubscriptionEvent {
    _source: string;
    constructor(args: {
        source: string;
    }) {
        this._source = args.source
    }

    async publish(): Promise<void> {
        const targetSessions = ((await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
            Key: { ConnectionId: `STREAM#${this._source}`},
            ProjectionFields: ['DataCategory']
        })) || []).map(({ DataCategory }) => (DataCategory))
        const targetConnections = unique((await Promise.all(
            targetSessions.map((sessionId) => {
                if (sessionId.startsWith('SESSION#')) {
                    return internalCache.SessionConnections.get(sessionId.slice(8))
                }
                else {
                    return internalCache.SessionConnections.get(sessionId)
                }
            })
        )).flat(1).filter(excludeUndefined)).map((connectionId) => (connectionId.startsWith('CONNECTION#') ? connectionId.slice(11) : connectionId))
        await Promise.all(
            targetConnections.map(async (connectionId) => {
                await apiClient.send(
                    connectionId,
                    { messageType: 'Pong' }
                )
            })
        )
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

    async subscribe(message: SubscribeAPIMessage, sessionId: `SESSION#${string}` ): Promise<void> {
        const ConnectionId = `STREAM#${this._source}${message.detail ? `::${message.detail}` : ''}`
        await connectionDB.putItem({
            ConnectionId,
            DataCategory: sessionId
        })
    }
}

export class SubscriptionLibrary {
    _library: SubscriptionHandler[];

    constructor(args: {
        library: SubscriptionHandler[]
    }) {
        this._library = args.library
    }

    match(event: Record<string, any>): SubscriptionHandler | undefined {
        return this._library.reduce<SubscriptionHandler | undefined>((previous, handler) => {
            if (!previous && handler.match(event)) {
                return handler
            }
            return previous
        }, undefined)
    }

    matchEvent(event: Record<string, any>): SubscriptionEvent | undefined {
        return this._library.reduce<SubscriptionEvent | undefined>((previous, handler) => {
            if (!previous) {
                const match = handler.match(event)
                if (match) {
                    return match
                }
            }
            return previous
        }, undefined)
    }

}