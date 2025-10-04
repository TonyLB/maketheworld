// Assets Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Assets data source.
// Migrated from lambda/assets/dataSource/serializers.ts

import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { isStandardComponent, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

// Internal types for component events (using StandardComponent objects)
export type ComponentEventUpdate = ComponentUpdatedEvent

export type ComponentUpdatedEvent = {
    type: 'Component Updated'
    component: StandardComponent // The actual component object for internal processing
}

// Type guards for component events
export const isComponentUpdatedEvent = (event: ComponentEventUpdate): event is ComponentUpdatedEvent => {
    return event.type === 'Component Updated'
}

// Type guards for assets events (full union type)
export const isAssetsComponentUpdatedEvent = (event: any): event is ComponentUpdatedEvent => {
    return event != null &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Component Updated'
        && 'component' in event
        && isStandardComponent(event.component)
}

export const isAssetsComponentEvent = (event: any): event is ComponentEventUpdate => {
    return isAssetsComponentUpdatedEvent(event)
}

export const isAssetsLevelEvent = (event: AssetsEventUpdate): event is AssetLevelEventUpdate => {
    return 'type' in event && ['Asset Cached', 'Asset Decached', 'Asset Removed', 'Canon Updated', 'Zone Updated'].includes(event.type)
}

// Specific type guards for each asset-level event type
export const isAssetCachedEvent = (event: any): event is AssetCachedEventUpdate => {
    return event?.type === 'Asset Cached' && typeof event.zone === 'string'
}

export const isAssetDecachedEvent = (event: any): event is AssetDecachedEventUpdate => {
    return event?.type === 'Asset Decached'
}

export const isAssetRemovedEvent = (event: any): event is AssetRemovedEventUpdate => {
    return event?.type === 'Asset Removed'
}

export const isCanonUpdatedEvent = (event: any): event is CanonUpdatedEventUpdate => {
    return event?.type === 'Canon Updated' && Array.isArray(event.assetIds)
}

export const isZoneUpdatedEvent = (event: any): event is ZoneUpdatedEventUpdate => {
    return event?.type === 'Zone Updated' && 
           typeof event.fromZone === 'string' && 
           typeof event.toZone === 'string'
}

export type ComponentEventExternal = ComponentUpdatedEventExternal

export type ComponentUpdatedEventExternal = {
    type: 'Component Updated'
    componentId: string
    wml: string // Serialized WML for external consumption
}

// Union type for all internal event updates in mtw.assets
export type AssetsEventUpdate = ComponentEventUpdate | AssetLevelEventUpdate

// Specific asset-level event types (non-component events)
// Note: assetId is available via streamKey, so we don't duplicate it in the payload
export type AssetCachedEventUpdate = {
    type: 'Asset Cached'
    zone: string
    wml?: string
}

export type AssetDecachedEventUpdate = {
    type: 'Asset Decached'
}

export type AssetRemovedEventUpdate = {
    type: 'Asset Removed'
}

export type CanonUpdatedEventUpdate = {
    type: 'Canon Updated'
    assetIds: string[]
}

export type ZoneUpdatedEventUpdate = {
    type: 'Zone Updated'
    fromZone: string
    toZone: string
}

// Union type for all asset-level event updates
export type AssetLevelEventUpdate = 
    | AssetCachedEventUpdate 
    | AssetDecachedEventUpdate 
    | AssetRemovedEventUpdate 
    | CanonUpdatedEventUpdate 
    | ZoneUpdatedEventUpdate

// Union type for all external event payloads
export type AssetsEventExternal = ComponentEventExternal | AssetLevelEventExternal

// Specific external asset-level event types
// Note: assetId is available via streamKey, so we don't duplicate it in the payload
export type AssetCachedEventExternal = {
    type: 'Asset Cached'
    zone: string
    wml?: string
}

export type AssetDecachedEventExternal = {
    type: 'Asset Decached'
}

export type AssetRemovedEventExternal = {
    type: 'Asset Removed'
}

export type CanonUpdatedEventExternal = {
    type: 'Canon Updated'
    assetIds: string[]
}

export type ZoneUpdatedEventExternal = {
    type: 'Zone Updated'
    fromZone: string
    toZone: string
}

// Union type for all external asset-level events
export type AssetLevelEventExternal = 
    | AssetCachedEventExternal 
    | AssetDecachedEventExternal 
    | AssetRemovedEventExternal 
    | CanonUpdatedEventExternal 
    | ZoneUpdatedEventExternal

/**
 * Unified event serializer for the mtw.assets data source.
 * 
 * This serializer intelligently handles different types of events based on their detailType metadata:
 * - Component events: Converts StandardComponent objects to WML for external consumption
 * - Asset-level events: Passes through data as-is
 */
export class AssetsEventSerializer implements DataSourceEventSerializer<AssetsEventUpdate, AssetsEventExternal> {
    serialize(params: {
        dataSourceKey: string;
        streamKey: string;
        update: AssetsEventUpdate;
    }): AssetsEventExternal {
        const { update } = params
        
        // Use the embedded type property to determine what type of event we're serializing
        if (isAssetsComponentUpdatedEvent(update)) {
            const { component } = update
            return {
                type: 'Component Updated',
                componentId: component.universalKey || '', // Extract componentId from component
                wml: schemaToWML([component.schema])
            }
        } else if (isAssetsLevelEvent(update)) {
            // This is an asset-level event - pass through as-is since internal and external types are now identical
            return update as AssetLevelEventExternal
        } else {
            throw new Error(`Unknown event type in AssetsEventUpdate: ${JSON.stringify(update)}`)
        }
    }
    
    deserialize(params: { 
        dataSourceKey: string
        detailType: string
        streamKey: string
        externalUpdate: AssetsEventExternal 
    }): AssetsEventUpdate | null {
        const { streamKey, externalUpdate } = params
        
        // Use the embedded type property to determine how to deserialize
        if (externalUpdate.type === 'Component Updated') {
            const updatedExternal = externalUpdate as ComponentUpdatedEventExternal
            return {
                type: 'Component Updated',
                component: this.parseWMLToComponent(updatedExternal.wml, updatedExternal.componentId)
            }
        } else {
            // This is an asset-level event - pass through as-is since internal and external types are now identical
            return externalUpdate as AssetLevelEventUpdate
        }
    }
    
    private parseWMLToComponent(wml: string, componentId: string): StandardComponent {
        // Parse WML back to StandardComponent using the proper factory
        // The WML should be just the component itself, not wrapped in an Asset
        const node = nodeFromWML(wml)
        const component = standardComponentFactory(node)
        if (!component) {
            throw new Error(`Could not create component from WML: ${wml}`)
        }
        if (component.universalKey !== componentId) {
            throw new Error(`Component ID mismatch: expected ${componentId}, got ${component.universalKey}`)
        }
        return component
    }
}