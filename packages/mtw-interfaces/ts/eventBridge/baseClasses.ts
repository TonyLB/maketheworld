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
