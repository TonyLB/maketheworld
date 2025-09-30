import { SubscribeAPIMessage, SubscriptionClientMessage, isSubscriptionClientMessage, UnsubscribeAPIMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists';
import internalCache from '../internalCache';
import { apiClient } from '../apiClient';
import { CoreExternalFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform';

export class SubscriptionEvent {
    _dataSourceKey: string;
    _type?: string;
    _streamKey?: string;
    _transform?: (event: CoreExternalFormat) => SubscriptionClientMessage;
    constructor(args: {
        dataSourceKey: string;
        type?: string;
        streamKey?: string;
        transform?: (event: CoreExternalFormat) => SubscriptionClientMessage;
    }) {
        this._dataSourceKey = args.dataSourceKey
        this._type = args.type
        this._streamKey = args.streamKey
        this._transform = args.transform
    }

    async publish(event: CoreExternalFormat): Promise<void> {
        const ConnectionId = `STREAM#${this._dataSourceKey}${this._type ? `::${this._type}` : ''}${this._streamKey ? `::${this._streamKey}` : ''}`
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
        const message = this._transform ? this._transform(event) : event
        if (!isSubscriptionClientMessage(message)) {
            throw new Error('Invalid subscription transform')
        }
        await Promise.all(
            targetConnections.map(async (connectionId) => {
                await apiClient.send(
                    connectionId,
                    message
                )
            })
        )
    }
}

export class SubscriptionHandler {
    _dataSourceKey: string;
    _type?: string;
    _transform?: (event: CoreExternalFormat) => SubscriptionClientMessage;
    constructor(args: {
        dataSourceKey: string;
        type?: string;
        transform?: (event: CoreExternalFormat) => SubscriptionClientMessage;
    }) {
        this._dataSourceKey = args.dataSourceKey
        this._type = args.type
        this._transform = args.transform
    }

    match(event: Omit<CoreExternalFormat, 'update' | 'streamKey'> & { type: string; streamKey?: string }): SubscriptionEvent | undefined {
        const eventSource = (event as any).dataSourceKey
        const matchesSource = eventSource === this._dataSourceKey
        const matchesType = (!this._type) || this._type === event.type
        if (matchesSource && matchesType) {
            return new SubscriptionEvent({
                ...event,
                dataSourceKey: this._dataSourceKey,
                type: this._type,
                streamKey: event.streamKey,
                transform: this._transform
            })
        }
        return
    }
    
    async subscribe(message: SubscribeAPIMessage, sessionId: `SESSION#${string}` ): Promise<void> {
        const ConnectionId = `STREAM#${this._dataSourceKey}${this._type ? `::${this._type}` : ''}${message.streamKey ? `::${message.streamKey}` : ''}`
        await connectionDB.putItem({
            ConnectionId,
            DataCategory: sessionId
        })
    }

    async unsubscribe(message: UnsubscribeAPIMessage, sessionId: `SESSION#${string}`): Promise<void> {
        const ConnectionId = `STREAM#${this._dataSourceKey}${this._type ? `::${this._type}` : ''}${message.streamKey ? `::${message.streamKey}` : ''}`
        await connectionDB.deleteItem({
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

    match(event: Omit<CoreExternalFormat, 'update' | 'streamKey'> & { type: string; streamKey?: string }): SubscriptionHandler | undefined {
        return this._library.reduce<SubscriptionHandler | undefined>((previous, handler) => {
            if (!previous && handler.match(event)) {
                return handler
            }
            return previous
        }, undefined)
    }

    matchEvent(event: CoreExternalFormat): SubscriptionEvent | undefined {
        return this._library.reduce<SubscriptionEvent | undefined>((previous, handler) => {
            if (!previous) {
                const { update, ...rest } = event
                const match = handler.match({ ...rest, type: update?.type })
                if (match) {
                    return match
                }
            }
            return previous
        }, undefined)
    }

}