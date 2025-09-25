import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'

// Internal types for WML events
export type WMLContentEvent = {
    type: 'Content Update' | 'Content Removed'
    AssetId: string
    schema?: any // For Content Update events
}

export type WMLZoneEvent = {
    type: 'Zone Changed'
    AssetId: string
    fromZone: string
    toZone: string
    player?: string
    subFolder?: string
}

// Union type for all internal WML events
export type WMLEventUpdate = WMLContentEvent | WMLZoneEvent

// External types for WML events
export type WMLContentEventExternal = {
    type: 'Content Update' | 'Content Removed'
    AssetId: string
    wml?: string // For Content Update events
}

export type WMLZoneEventExternal = {
    type: 'Zone Changed'
    AssetId: string
    fromZone: string
    toZone: string
    player?: string
    subFolder?: string
}

// Union type for all external WML events
export type WMLEventExternal = WMLContentEventExternal | WMLZoneEventExternal

// Type guards
export const isWMLContentEvent = (event: WMLEventUpdate): event is WMLContentEvent => {
    return event.type === 'Content Update' || event.type === 'Content Removed'
}

export const isWMLZoneEvent = (event: WMLEventUpdate): event is WMLZoneEvent => {
    return event.type === 'Zone Changed'
}

/**
 * Serializer/Deserializer for WML format events
 * 
 * This handles the conversion between:
 * - Internal event objects (for messageBus communication)
 * - External event objects (for EventBridge transmission)
 * 
 * Different event types are handled differently:
 * - Content events: Convert StandardForm to/from WML strings
 * - Zone events: Pass through as structured data
 */
export class WMLEventSerializer implements DataSourceEventSerializer<WMLEventUpdate, WMLEventExternal> {
    /**
     * Serialize an internal event to external format
     * for EventBridge transmission
     */
    serialize({ update }: { update: WMLEventUpdate }): WMLEventExternal {
        if (isWMLZoneEvent(update)) {
            // Zone events pass through as-is (they're already structured data)
            return update as WMLZoneEventExternal
        } else if (isWMLContentEvent(update)) {
            // Content events need WML conversion
            if (update.type === 'Content Update' && update.schema) {
                return {
                    type: 'Content Update',
                    AssetId: update.AssetId,
                    wml: schemaToWML([update.schema])
                }
            } else {
                // Content Removed events don't need WML
                return {
                    type: 'Content Removed',
                    AssetId: update.AssetId
                }
            }
        } else {
            throw new Error(`Unknown WML event type: ${JSON.stringify(update)}`)
        }
    }

    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    deserialize(params: { dataSourceKey: string; detailType: string; streamKey: string; externalUpdate: WMLEventExternal }): WMLEventUpdate | null {
        const { externalUpdate } = params
        
        if (externalUpdate.type === 'Zone Changed') {
            // Zone events pass through as-is
            return externalUpdate as WMLZoneEvent
        } else if (externalUpdate.type === 'Content Update' || externalUpdate.type === 'Content Removed') {
            if (externalUpdate.type === 'Content Update' && 'wml' in externalUpdate && externalUpdate.wml) {
                try {
                    // Parse WML string back to StandardForm
                    const schemaNode = nodeFromWML(externalUpdate.wml)
                    const standardForm = new StandardForm(schemaNode)
                    return {
                        type: 'Content Update',
                        AssetId: externalUpdate.AssetId,
                        schema: standardForm.schema
                    }
                } catch (error) {
                    throw new Error(`Failed to deserialize WML: ${error instanceof Error ? error.message : String(error)}`)
                }
            } else {
                // Content Removed events don't need WML parsing
                return {
                    type: 'Content Removed',
                    AssetId: externalUpdate.AssetId
                }
            }
        } else {
            throw new Error(`Unknown external WML event type: ${JSON.stringify(externalUpdate)}`)
        }
    }
}
