// EventBridge Base Classes and Shared Interfaces
//
// This file contains shared types and interfaces used across all EventBridge event contracts.

import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Re-export the base serializer interface for convenience
export type { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Common event payload structure
export type EventPayload = {
    type: string;
} & Record<string, unknown>

// Common external event structure for EventBridge
export type EventBridgeEvent = {
    Source: string;
    DetailType: string;
    Detail: EventPayload;
    Time?: string;
    Resources?: string[];
}

// Common internal event structure for messageBus
export type InternalEvent = {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    event: EventPayload;
}

// Type guard for event payload validation
export const isEventPayload = (event: unknown): event is EventPayload => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        typeof (event as any).type === 'string'
    )
}

// Utility type for creating event serializers
export type EventSerializer<TInternal extends EventPayload, TExternal extends EventPayload> = 
    DataSourceEventSerializer<TInternal, TExternal>

// Generic subscription client message types
export type SubscriptionClientMessage<T extends EventPayload = EventPayload> = {
    messageType: 'Subscription';
    dataSourceKey: string;
    streamKey: string;
    update: T;
    RequestId?: string;
}

// Type guard for subscription client messages
export const isSubscriptionClientMessage = <T extends EventPayload>(
    message: unknown,
    updateTypeGuard?: (update: unknown) => update is T
): message is SubscriptionClientMessage<T> => {
    if (!message || typeof message !== 'object') return false
    
    const msg = message as any
    if (msg.messageType !== 'Subscription') return false
    if (typeof msg.dataSourceKey !== 'string') return false
    if (typeof msg.streamKey !== 'string') return false
    if (!msg.update || typeof msg.update !== 'object') return false
    
    // If a specific update type guard is provided, use it
    if (updateTypeGuard) {
        return updateTypeGuard(msg.update)
    }
    
    // Otherwise, just check that it has a type field
    return typeof msg.update.type === 'string'
}