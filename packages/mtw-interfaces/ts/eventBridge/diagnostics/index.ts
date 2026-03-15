import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'

//
// Internal types for diagnostics events
//

export type DiagnosticsS3StructureFindingEvent = {
    type: 'S3 Structure Finding'
    source: string              // e.g., "primitives.wml"
    status: 'missing' | 'present' | 'corrupted' | 'unexpected'
    diagnosticRunId: string
    timestamp: string
}

export type DiagnosticsCacheConsistencyFindingEvent = {
    type: 'Cache Consistency Finding'
    assetId: string             // e.g., "ASSET#primitives"
    status: 'stale' | 'missing'
    diagnosticRunId: string
    timestamp: string
}

/** Heal Global Values content shape (for deserialize only; produced elsewhere) */
export type DiagnosticsHealGlobalValuesContent = {
    type: 'Heal Global Values'
    connections?: unknown
    assets?: unknown
}

// Union type for all internal diagnostics events
export type DiagnosticsEventUpdate =
    | DiagnosticsS3StructureFindingEvent
    | DiagnosticsCacheConsistencyFindingEvent
    | DiagnosticsHealGlobalValuesContent

//
// External types for diagnostics events (EventBridge format)
//

export type DiagnosticsS3StructureFindingEventExternal = {
    type: 'S3 Structure Finding'
    source: string
    status: 'missing' | 'present' | 'corrupted' | 'unexpected'
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsCacheConsistencyFindingEventExternal = {
    type: 'Cache Consistency Finding'
    assetId: string
    status: 'stale' | 'missing'
    diagnosticRunId?: string
    timestamp?: string
}

export type DiagnosticsEventExternal =
    | DiagnosticsS3StructureFindingEventExternal
    | DiagnosticsCacheConsistencyFindingEventExternal

//
// Type guards
//

export const isS3StructureFindingEvent = (event: any): event is DiagnosticsS3StructureFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'S3 Structure Finding' &&
        typeof event.source === 'string' &&
        typeof event.status === 'string' &&
        ['missing', 'present', 'corrupted', 'unexpected'].includes(event.status)
    )
}

export const isCacheConsistencyFindingEvent = (event: any): event is DiagnosticsCacheConsistencyFindingEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Cache Consistency Finding' &&
        typeof event.assetId === 'string' &&
        typeof event.status === 'string' &&
        ['stale', 'missing'].includes(event.status)
    )
}

export const isDiagnosticsEventUpdate = (event: unknown): event is DiagnosticsEventUpdate => {
    return isS3StructureFindingEvent(event) || isCacheConsistencyFindingEvent(event) ||
        (typeof event === 'object' && event !== null && (event as any).type === 'Heal Global Values')
}

/**
 * Serializer/Deserializer for diagnostics format events
 * 
 * Handles conversion between:
 * - Internal event objects (for messageBus communication)
 * - External event objects (for EventBridge transmission)
 * 
 * The detail-type field from EventBridge becomes the 'type' field internally
 */
export class DiagnosticsEventSerializer implements DataSourceEventSerializer<DiagnosticsEventUpdate, DiagnosticsEventExternal> {
    constructor(private readonly env: DataSourceEnvironment) {}
    /**
     * Serialize an internal event to external format for EventBridge transmission
     */
    serialize(params: {
        content: DiagnosticsEventUpdate;
        header: StreamingEventHeader;
    }): DiagnosticsEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('DiagnosticsEventSerializer does not support snapshot serialization')
        }
        if (header.type === 'S3 Structure Finding' && isS3StructureFindingEvent(content)) {
            return {
                type: 'S3 Structure Finding',
                source: content.source,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        if (header.type === 'Cache Consistency Finding' && isCacheConsistencyFindingEvent(content)) {
            return {
                type: 'Cache Consistency Finding',
                assetId: content.assetId,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId,
                timestamp: content.timestamp
            }
        }
        throw new Error(`Unknown diagnostics event type: ${header.type}`)
    }

    /**
     * Deserialize an external event to internal format for messageBus processing
     *
     * Note: The detail-type from EventBridge becomes the 'type' field in content
     * via the fromEventBridgeFormat transformation
     */
    async deserialize(params: {
        content: any  // Will have type field from EventBridge detail-type
        header: StreamingEventHeader
    }): Promise<DiagnosticsEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        const eventType = header.type

        // The type field comes from EventBridge detail-type
        if (eventType === 'S3 Structure Finding') {
            // Validate required fields
            if (typeof content.source !== 'string' || typeof content.status !== 'string') {
                return null
            }

            return {
                type: 'S3 Structure Finding',
                source: content.source,
                status: content.status,
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Cache Consistency Finding') {
            if (typeof content.assetId !== 'string' || typeof content.status !== 'string') {
                return null
            }
            if (!['stale', 'missing'].includes(content.status)) {
                return null
            }
            return {
                type: 'Cache Consistency Finding',
                assetId: content.assetId,
                status: content.status as 'stale' | 'missing',
                diagnosticRunId: content.diagnosticRunId || 'unknown',
                timestamp: content.timestamp || new Date().toISOString()
            }
        }

        if (eventType === 'Heal Global Values') {
            return {
                type: 'Heal Global Values',
                connections: content.connections,
                assets: content.assets
            }
        }

        return null
    }
}

