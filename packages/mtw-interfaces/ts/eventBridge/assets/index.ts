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
    assetId: string
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
    return 'type' in event && ['Asset Cached', 'Asset Decached', 'Asset Removed', 'Canon Updated'].includes(event.type)
}

export type ComponentEventExternal = ComponentUpdatedEventExternal

export type ComponentUpdatedEventExternal = {
    type: 'Component Updated'
    assetId: string
    componentId: string
    wml: string // Serialized WML for external consumption
}

// Union type for all internal event updates in mtw.assets
export type AssetsEventUpdate = ComponentEventUpdate | AssetLevelEventUpdate

// Asset-level event types (non-component events)
export type AssetLevelEventUpdate = {
    type: 'Asset Cached' | 'Asset Decached' | 'Asset Removed' | 'Canon Updated'
    assetId?: string
    assetIds?: string[]
    [key: string]: any // Allow additional properties
}

// Union type for all external event payloads
export type AssetsEventExternal = ComponentEventExternal | AssetLevelEventExternal

export type AssetLevelEventExternal = {
    type: 'Asset Cached' | 'Asset Decached' | 'Asset Removed' | 'Canon Updated'
    assetId?: string
    assetIds?: string[]
    [key: string]: any // Allow additional properties
}

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
            const { assetId, component } = update
            return {
                type: 'Component Updated',
                assetId,
                componentId: component.universalKey || '', // Extract componentId from component
                wml: schemaToWML([component.schema])
            }
        } else if (isAssetsLevelEvent(update)) {
            // This is an asset-level event - pass through as-is
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
                assetId: streamKey,
                component: this.parseWMLToComponent(updatedExternal.wml, updatedExternal.componentId)
            }
        } else {
            // This is an asset-level event - pass through as-is
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