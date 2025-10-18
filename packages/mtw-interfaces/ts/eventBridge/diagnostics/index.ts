import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

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

// Union type for all internal diagnostics events
export type DiagnosticsEventUpdate = DiagnosticsS3StructureFindingEvent

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

export type DiagnosticsEventExternal = DiagnosticsS3StructureFindingEventExternal

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

export const isDiagnosticsEventUpdate = (event: unknown): event is DiagnosticsEventUpdate => {
    return isS3StructureFindingEvent(event)
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
    /**
     * Serialize an internal event to external format for EventBridge transmission
     */
    serialize({ update }: { update: DiagnosticsEventUpdate }): DiagnosticsEventExternal {
        if (update.type === 'S3 Structure Finding') {
            return {
                type: 'S3 Structure Finding',
                source: update.source,
                status: update.status,
                diagnosticRunId: update.diagnosticRunId,
                timestamp: update.timestamp
            }
        }
        // Should never reach here due to type system
        throw new Error(`Unknown diagnostics event type: ${(update as any).type}`)
    }

    /**
     * Deserialize an external event to internal format for messageBus processing
     * 
     * Note: The detail-type from EventBridge becomes the 'type' field in externalUpdate
     * via the fromEventBridgeFormat transformation
     */
    deserialize(params: { 
        dataSourceKey: string
        streamKey: string
        externalUpdate: any  // Will have type field from EventBridge detail-type
    }): DiagnosticsEventUpdate | null {
        const { externalUpdate } = params
        
        // The type field comes from EventBridge detail-type
        if (externalUpdate.type === 'S3 Structure Finding') {
            // Validate required fields
            if (typeof externalUpdate.source !== 'string' || typeof externalUpdate.status !== 'string') {
                return null
            }
            
            return {
                type: 'S3 Structure Finding',
                source: externalUpdate.source,
                status: externalUpdate.status,
                diagnosticRunId: externalUpdate.diagnosticRunId || 'unknown',
                timestamp: externalUpdate.timestamp || new Date().toISOString()
            }
        }
        
        return null
    }
}

