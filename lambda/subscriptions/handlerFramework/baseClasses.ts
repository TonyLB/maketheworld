import { isSubscriptionsAPIMessage, isSubscribeAPIMessage, SubscribeAPIMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists';
import internalCache from '../internalCache';
import { apiClient } from '../apiClient';

export class SubscriptionEvent {
    _source: string;
    _detailType?: string;
    _detailExtract?: string;
    constructor(args: {
        source: string;
        detailType?: string;
        detailExtract?: string;
    }) {
        this._source = args.source
        this._detailType = args.detailType
        this._detailExtract = args.detailExtract
    }

    async publish(): Promise<void> {
        const ConnectionId = `STREAM#${this._source}${this._detailType ? `::${this._detailType}` : ''}${this._detailExtract ? `::${this._detailExtract}` : ''}`
        const targetSessions = ((await connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
            Key: { ConnectionId },
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
    _detailType?: string;
    _detailExtract?: (event: Record<string, any>) => string;
    constructor(args: {
        source: string;
        detailType?: string;
        detailExtract?: (event: Record<string, any>) => string;
    }) {
        this._source = args.source
        this._detailType = args.detailType
        this._detailExtract = args.detailExtract
    }

    match(event: Record<string, any>): SubscriptionEvent | undefined {
        const matchesSource = "source" in event && event.source === this._source
        const matchesDetailType = (!this._detailType) || this._detailType === event.detailType
        if (matchesSource && matchesDetailType) {
            return new SubscriptionEvent({
                ...event,
                source: this._source,
                detailType: this._detailType,
                detailExtract: this._detailExtract ? this._detailExtract(event) : undefined
            })
        }
        return
    }
    
    isSubscribe(event: Record<string, any>): boolean {
        return isSubscriptionsAPIMessage(event) && isSubscribeAPIMessage(event)
    }

    async subscribe(message: Record<string, any> & SubscribeAPIMessage, sessionId: `SESSION#${string}` ): Promise<void> {
        const detailExtract = this._detailExtract ? this._detailExtract(message) : undefined
        const ConnectionId = `STREAM#${this._source}${this._detailType ? `::${this._detailType}` : ''}${detailExtract ? `::${detailExtract}` : ''}`
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