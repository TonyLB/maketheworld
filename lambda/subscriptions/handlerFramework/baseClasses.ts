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
        
        // Build session -> connections mapping
        const sessionConnectionEntries = await Promise.all(
            targetSessions.map(async (sessionId) => {
                const sessionKey = sessionId.startsWith('SESSION#') ? sessionId.slice(8) : sessionId
                const connections = await internalCache.SessionConnections.get(sessionKey)
                if (connections && connections.length > 0) {
                    const normalizedConnections = connections
                        .filter(excludeUndefined)
                        .map((connectionId) => (connectionId.startsWith('CONNECTION#') ? connectionId.slice(11) : connectionId))
                    if (normalizedConnections.length > 0) {
                        return [sessionId, normalizedConnections] as const
                    }
                }
                return null
            })
        )
        const sessionConnectionMap: Record<string, string[]> = Object.fromEntries(
            sessionConnectionEntries.filter((entry): entry is readonly [string, string[]] => entry !== null)
        )
        
        const baseMessage = this._transform ? this._transform(event) : event
        if (!isSubscriptionClientMessage(baseMessage)) {
            throw new Error('Invalid subscription transform')
        }
        
        // Send message to all connections (SessionId is now sent once via SessionInitialized coordination message)
        await Promise.all(
            Object.entries(sessionConnectionMap).flatMap(([sessionId, connections]) => {
                return connections.map(async (connectionId) => {
                    await apiClient.send(connectionId, baseMessage)
                })
            })
        )
    }
}

export class SubscriptionHandler {
    _dataSourceKey: string;
    _type?: string;
    _transform?: (event: CoreExternalFormat) => SubscriptionClientMessage;
    _coreFormatGuard?: (event: CoreExternalFormat) => boolean;
    constructor(args: {
        dataSourceKey: string;
        type?: string;
        transform?: (event: CoreExternalFormat) => SubscriptionClientMessage;
        coreFormatGuard?: (event: CoreExternalFormat) => boolean;
    }) {
        this._dataSourceKey = args.dataSourceKey
        this._type = args.type
        this._transform = args.transform
        this._coreFormatGuard = args.coreFormatGuard
    }

    match(event: { dataSourceKey: string; type?: string; streamKey?: string }): SubscriptionEvent | undefined {
        const eventSource = (event as any).dataSourceKey
        const matchesSource = eventSource === this._dataSourceKey
        // For subscription requests (no type field), match on dataSourceKey only
        // For EventBridge events (with type field), also match on type
        const matchesType = (!event.type) || (!this._type) || this._type === event.type
        if (matchesSource && matchesType) {
            return new SubscriptionEvent({
                ...event,
                dataSourceKey: this._dataSourceKey,
                // Only use handler's _type if explicitly defined; don't fall back to event.type
                // This ensures ConnectionId construction matches subscription storage
                type: this._type,
                streamKey: event.streamKey,
                transform: this._transform
            })
        }
        return
    }
    
    async subscribe(message: SubscribeAPIMessage, sessionId: `SESSION#${string}` ): Promise<void> {
        // Subscribe to all stream keys in the array
        await Promise.all(
            message.streamKeys.map((streamKey) => {
                const ConnectionId = `STREAM#${this._dataSourceKey}${this._type ? `::${this._type}` : ''}::${streamKey}`
                return connectionDB.putItem({
                    ConnectionId,
                    DataCategory: sessionId
                })
            })
        )
    }

    async unsubscribe(message: UnsubscribeAPIMessage, sessionId: `SESSION#${string}`): Promise<void> {
        // Unsubscribe from all stream keys in the array
        await Promise.all(
            message.streamKeys.map((streamKey) => {
                const ConnectionId = `STREAM#${this._dataSourceKey}${this._type ? `::${this._type}` : ''}::${streamKey}`
                return connectionDB.deleteItem({
                    ConnectionId,
                    DataCategory: sessionId
                })
            })
        )
    }
}

export class SubscriptionLibrary {
    _library: SubscriptionHandler[];

    constructor(args: {
        library: SubscriptionHandler[]
    }) {
        this._library = args.library
    }

    match(event: { dataSourceKey: string; type?: string; streamKey?: string }): SubscriptionHandler | undefined {
        return this._library.reduce<SubscriptionHandler | undefined>((previous, handler) => {
            if (!previous && handler.match(event)) {
                return handler
            }
            return previous
        }, undefined)
    }

    /**
     * Return all handlers that match the request (e.g. subscribe with dataSourceKey + streamKeys).
     * Used so one subscribe request can register for multiple event types (e.g. mtw.wml Content Update and Merge Conflict).
     */
    matchAll(event: { dataSourceKey: string; type?: string; streamKey?: string }): SubscriptionHandler[] {
        return this._library.filter((handler) => handler.match(event))
    }

    /**
     * Match an event (CoreExternalFormat) to a subscription handler. Routing uses the envelope header
     * when present: event.header is authoritative for dataSourceKey, streamKey, and type;
     * event.update?.type is only a fallback when event.header is missing.
     */
    matchEvent(event: CoreExternalFormat): SubscriptionEvent | undefined {
        const dataSourceKey = event.header?.dataSourceKey ?? event.dataSourceKey
        const streamKey = event.header?.streamKey ?? event.streamKey
        const type = event.header?.type ?? event.update?.type
        return this._library.reduce<SubscriptionEvent | undefined>((previous, handler) => {
            if (!previous) {
                if (handler._coreFormatGuard?.(event)) {
                    return new SubscriptionEvent({
                        dataSourceKey: handler._dataSourceKey,
                        type: handler._type,
                        streamKey,
                        transform: handler._transform
                    })
                }
                const match = handler.match({ dataSourceKey, streamKey, type })
                if (match) {
                    return match
                }
            }
            return previous
        }, undefined)
    }

}