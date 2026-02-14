// Assets Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Assets data source.
// Migrated from lambda/assets/dataSource/serializers.ts

import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { isStandardComponent, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

// Internal types for component events (using StandardComponent objects)
export type ComponentEventUpdate = ComponentUpdatedEvent | ComponentRemovedEvent

export type ComponentUpdatedEvent = {
    type: 'Component Updated'
    component: StandardComponent // The actual component object for internal processing
}

export type ComponentRemovedEvent = {
    type: 'Component Removed'
    component: StandardComponent // The component being removed from the asset
}

// Type guards for component events
export const isComponentUpdatedEvent = (event: ComponentEventUpdate): event is ComponentUpdatedEvent => {
    return event.type === 'Component Updated'
}

export const isComponentRemovedEvent = (event: ComponentEventUpdate): event is ComponentRemovedEvent => {
    return event.type === 'Component Removed'
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

export const isAssetsComponentRemovedEvent = (event: any): event is ComponentRemovedEvent => {
    return event != null &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Component Removed'
        && 'component' in event
        && isStandardComponent(event.component)
}

export const isAssetsComponentEvent = (event: any): event is ComponentEventUpdate => {
    return isAssetsComponentUpdatedEvent(event) || isAssetsComponentRemovedEvent(event)
}

export const isAssetsLevelEvent = (event: AssetsEventUpdate): event is AssetLevelEventUpdate => {
    return 'type' in event && ['Asset Added', 'Asset Cached', 'Asset Decached', 'Asset Removed', 'Canon Updated', 'Zone Updated', 'Asset Updated'].includes(event.type)
}

// Specific type guards for each asset-level event type
export const isAssetAddedEvent = (event: any): event is AssetAddedEventUpdate => {
    return event?.type === 'Asset Added' && typeof event.zone === 'string'
}

export const isAssetCachedEvent = (event: any): event is AssetCachedEventUpdate => {
    return event?.type === 'Asset Cached' && typeof event.zone === 'string'
}

export const isAssetDecachedEvent = (event: any): event is AssetDecachedEventUpdate => {
    return event?.type === 'Asset Decached'
}

export const isAssetRemovedEvent = (event: any): event is AssetRemovedEventUpdate => {
    return event?.type === 'Asset Removed' && typeof event.zone === 'string'
}

export const isCanonUpdatedEvent = (event: any): event is CanonUpdatedEventUpdate => {
    return event?.type === 'Canon Updated' && Array.isArray(event.assetIds)
}

export const isZoneUpdatedEvent = (event: any): event is ZoneUpdatedEventUpdate => {
    return event?.type === 'Zone Updated' && 
           typeof event.fromZone === 'string' && 
           typeof event.toZone === 'string'
}

export const isAssetUpdatedEvent = (event: any): event is AssetUpdatedEventUpdate => {
    return event?.type === 'Asset Updated' && event.standardForm instanceof StandardForm
}

export type ComponentEventExternal = ComponentUpdatedEventExternal | ComponentRemovedEventExternal

export type ComponentUpdatedEventExternal = {
    type: 'Component Updated'
    componentId: string
    wml: string // Serialized WML for external consumption
}

export type ComponentRemovedEventExternal = {
    type: 'Component Removed'
    componentId: string
    wml: string // Serialized WML for external consumption
}

// Union type for all internal event updates in mtw.assets
export type AssetsEventUpdate = ComponentEventUpdate | AssetLevelEventUpdate

// Specific asset-level event types (non-component events)
// Note: assetId is available via streamKey, so we don't duplicate it in the payload
export type AssetAddedEventUpdate = {
    type: 'Asset Added'
    zone: string
    player?: string  // Present for Personal and Draft zones
}

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
    zone: string
    player?: string  // Present for Personal and Draft zones
}

export type CanonUpdatedEventUpdate = {
    type: 'Canon Updated'
    assetIds: string[]
}

export type ZoneUpdatedEventUpdate = {
    type: 'Zone Updated'
    fromZone: string
    toZone: string
    player?: string  // Present for Personal and Draft zones (in fromZone or toZone)
}

export type AssetUpdatedEventUpdate = {
    type: 'Asset Updated'
    standardForm: StandardForm
    player?: string  // Present for Personal and Draft zones
}

// Union type for all asset-level event updates
export type AssetLevelEventUpdate = 
    | AssetAddedEventUpdate
    | AssetCachedEventUpdate 
    | AssetDecachedEventUpdate 
    | AssetRemovedEventUpdate 
    | CanonUpdatedEventUpdate 
    | ZoneUpdatedEventUpdate
    | AssetUpdatedEventUpdate

// Union type for all external event payloads
export type AssetsEventExternal = ComponentEventExternal | AssetLevelEventExternal

// Specific external asset-level event types
// Note: assetId is available via streamKey, so we don't duplicate it in the payload
export type AssetAddedEventExternal = {
    type: 'Asset Added'
    zone: string
    player?: string  // Present for Personal and Draft zones
}

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
    zone: string
    player?: string  // Present for Personal and Draft zones
}

export type CanonUpdatedEventExternal = {
    type: 'Canon Updated'
    assetIds: string[]
}

export type ZoneUpdatedEventExternal = {
    type: 'Zone Updated'
    fromZone: string
    toZone: string
    player?: string  // Present for Personal and Draft zones (in fromZone or toZone)
}

export type AssetUpdatedEventExternal = {
    type: 'Asset Updated'
    wml: string
    player?: string  // Present for Personal and Draft zones
}

// Union type for all external asset-level events
export type AssetLevelEventExternal = 
    | AssetAddedEventExternal
    | AssetCachedEventExternal 
    | AssetDecachedEventExternal 
    | AssetRemovedEventExternal 
    | CanonUpdatedEventExternal 
    | ZoneUpdatedEventExternal
    | AssetUpdatedEventExternal

/**
 * Unified event serializer for the mtw.assets data source.
 * 
 * This serializer intelligently handles different types of events based on their detailType metadata:
 * - Component events: Converts StandardComponent objects to WML for external consumption
 * - Asset-level events: Passes through data as-is
 */
export class AssetsEventSerializer implements DataSourceEventSerializer<AssetsEventUpdate, AssetsEventExternal> {
    serialize(params: {
        update: AssetsEventUpdate;
        header: StreamingEventHeader;
    }): AssetsEventExternal {
        const { update, header } = params
        
        if (header.type === 'Component Updated') {
            const comp = update as ComponentUpdatedEvent
            const base = {
                componentId: comp.component.universalKey || '',
                wml: schemaToWML([comp.component.schema])
            }
            return {
                type: 'Component Updated',
                ...base
            }
        } else if (header.type === 'Component Removed') {
            const comp = update as ComponentRemovedEvent
            const base = {
                componentId: comp.component.universalKey || '',
                wml: schemaToWML([comp.component.schema])
            }
            return {
                type: 'Component Removed',
                ...base
            }
        } else if (header.type === 'Asset Updated') {
            const internal = update as AssetUpdatedEventUpdate
            return {
                type: 'Asset Updated',
                wml: schemaToWML([internal.standardForm.schema]),
                ...(internal.player ? { player: internal.player } : {})
            }
        } else {
            const assetLevelTypes = new Set(['Asset Added', 'Asset Cached', 'Asset Decached', 'Asset Removed', 'Canon Updated', 'Zone Updated'])
            if (assetLevelTypes.has(header.type)) {
                return update as AssetLevelEventExternal
            }
            throw new Error(`Unknown event type in AssetsEventUpdate: ${header.type}`)
        }
    }
    
    deserialize(params: { 
        externalUpdate: AssetsEventExternal
        header: StreamingEventHeader
    }): AssetsEventUpdate | null {
        const { externalUpdate, header } = params
        const eventType = header.type
        
        // Use the header type to determine how to deserialize
        if (eventType === 'Component Updated') {
            const updatedExternal = externalUpdate as ComponentUpdatedEventExternal
            return {
                type: 'Component Updated',
                component: this.parseWMLToComponent(updatedExternal.wml, updatedExternal.componentId)
            }
        } else if (eventType === 'Component Removed') {
            const removedExternal = externalUpdate as ComponentRemovedEventExternal
            return {
                type: 'Component Removed',
                component: this.parseWMLToComponent(removedExternal.wml, removedExternal.componentId)
            }
        } else {
            // This is an asset-level event - pass through as-is since internal and external types are now identical
            if ((externalUpdate as any).type === 'Asset Updated') {
                const external = externalUpdate as AssetUpdatedEventExternal
                return {
                    type: 'Asset Updated',
                    standardForm: new StandardForm(external.wml)
                }
            }
            return externalUpdate as AssetLevelEventUpdate
        }
    }
    
    private parseWMLToComponent(wml: string, componentId: string): StandardComponent {
        // Parse WML back to StandardComponent using the proper factory
        // The WML should be just the component itself, not wrapped in an Asset
        const node = nodeFromWML(wml)
        const { component } = standardComponentFactory(node)
        if (!component) {
            throw new Error(`Could not create component from WML: ${wml}`)
        }
        if (component.universalKey !== componentId) {
            throw new Error(`Component ID mismatch: expected ${componentId}, got ${component.universalKey}`)
        }
        return component
    }
}

// Re-export library data source contracts
export * from './library'