import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// Internal types for coordination events
export type CoordinationCanonizeEvent = {
    type: 'Canonize Asset'
    assetId: string
}

export type CoordinationDecanonizeEvent = {
    type: 'Decanonize Asset'
    assetId: string
}

// Union type for all internal coordination events
export type CoordinationEventUpdate = CoordinationCanonizeEvent | CoordinationDecanonizeEvent

// External types for coordination events (same as internal since they're hand-created)
export type CoordinationEventExternal = {
    assetId: string
}

// Type guards
export const isCoordinationEventUpdate = (event: unknown): event is CoordinationEventUpdate => {
    return typeof event === 'object' && 
           event !== null && 
           'type' in event && 
           (event.type === 'Canonize Asset' || event.type === 'Decanonize Asset') &&
           'assetId' in event &&
           typeof (event as any).assetId === 'string'
}

export const isCoordinationCanonizeEvent = (event: CoordinationEventUpdate): event is CoordinationCanonizeEvent => {
    return event.type === 'Canonize Asset'
}

export const isCoordinationDecanonizeEvent = (event: CoordinationEventUpdate): event is CoordinationDecanonizeEvent => {
    return event.type === 'Decanonize Asset'
}

/**
 * Serializer/Deserializer for coordination format events
 * 
 * This handles the conversion between:
 * - Internal event objects (for messageBus communication)
 * - External event objects (for EventBridge transmission)
 * 
 * Coordination events are hand-created and pass through as structured data
 */
export class CoordinationEventSerializer implements DataSourceEventSerializer<CoordinationEventUpdate, CoordinationEventExternal> {
    /**
     * Serialize an internal event to external format
     * for EventBridge transmission
     */
    serialize({ update }: { update: CoordinationEventUpdate }): CoordinationEventExternal {
        return {
            assetId: update.assetId
        }
    }

    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    deserialize(params: { dataSourceKey: string; detailType: string; streamKey: string; externalUpdate: CoordinationEventExternal }): CoordinationEventUpdate | null {
        const { detailType, externalUpdate } = params
        
        if (detailType === 'Canonize Asset') {
            return {
                type: 'Canonize Asset',
                assetId: externalUpdate.assetId
            }
        } else if (detailType === 'Decanonize Asset') {
            return {
                type: 'Decanonize Asset',
                assetId: externalUpdate.assetId
            }
        } else {
            return null
        }
    }
}
