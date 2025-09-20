import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRemove, StandardReplace } from '@tonylb/mtw-wml/ts/standardize/components/edits'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

// Internal types for component events (using StandardComponent objects)
export type ComponentEventUpdate = ComponentUpdatedEvent | ComponentRemovedEvent

export type ComponentUpdatedEvent = {
    type: 'Component Updated'
    assetId: string
    component: StandardComponent // The actual component object for internal processing
}

export type ComponentRemovedEvent = {
    type: 'Component Removed'
    assetId: string
    componentId: string
}

// Type guards for component events
export const isComponentUpdatedEvent = (event: ComponentEventUpdate): event is ComponentUpdatedEvent => {
    return event.type === 'Component Updated'
}

export const isComponentRemovedEvent = (event: ComponentEventUpdate): event is ComponentRemovedEvent => {
    return event.type === 'Component Removed'
}

// Type guards for assets events (full union type)
export const isAssetsComponentUpdatedEvent = (event: AssetsEventUpdate): event is ComponentUpdatedEvent => {
    return 'type' in event && event.type === 'Component Updated' && 'component' in event
}

export const isAssetsComponentRemovedEvent = (event: AssetsEventUpdate): event is ComponentRemovedEvent => {
    return 'type' in event && event.type === 'Component Removed' && 'componentId' in event
}

export const isAssetsComponentEvent = (event: AssetsEventUpdate): event is ComponentEventUpdate => {
    return isAssetsComponentUpdatedEvent(event) || isAssetsComponentRemovedEvent(event)
}

export const isAssetsLevelEvent = (event: AssetsEventUpdate): event is AssetLevelEventUpdate => {
    return 'type' in event && ['CacheAsset', 'DecacheAsset', 'RemoveAsset', 'Canon Updated'].includes(event.type)
}

export type ComponentEventExternal = ComponentUpdatedEventExternal | ComponentRemovedEventExternal

export type ComponentUpdatedEventExternal = {
    type: 'Component Updated'
    assetId: string
    componentId: string
    wml: string // Serialized WML for external consumption
}

export type ComponentRemovedEventExternal = {
    type: 'Component Removed'
    assetId: string
    componentId: string
}

// Union type for all internal event updates in mtw.assets
export type AssetsEventUpdate = ComponentEventUpdate | AssetLevelEventUpdate

// Asset-level event types (non-component events)
export type AssetLevelEventUpdate = {
    type: 'CacheAsset' | 'DecacheAsset' | 'RemoveAsset' | 'Canon Updated'
    assetId?: string
    assetIds?: string[]
    [key: string]: any // Allow additional properties
}

// Union type for all external event payloads
export type AssetsEventExternal = ComponentEventExternal | AssetLevelEventExternal

export type AssetLevelEventExternal = {
    type: 'CacheAsset' | 'DecacheAsset' | 'RemoveAsset' | 'Canon Updated'
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
        detailType: string;
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
        } else if (isAssetsComponentRemovedEvent(update)) {
            const { assetId, componentId } = update
            return {
                type: 'Component Removed',
                assetId,
                componentId
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
        } else if (externalUpdate.type === 'Component Removed') {
            const removedExternal = externalUpdate as ComponentRemovedEventExternal
            return {
                type: 'Component Removed',
                assetId: streamKey,
                componentId: removedExternal.componentId
            }
        } else {
            // This is an asset-level event - pass through as-is
            return externalUpdate as AssetLevelEventUpdate
        }
    }
    
    private parseWMLToComponent(wml: string, componentId: string): StandardComponent {
        // Parse WML back to StandardComponent
        // This is a simplified implementation - in practice you might need more robust parsing
        const standardForm = new StandardForm(wml)
        const component = standardForm._components.find(c => c.universalKey === componentId)
        if (!component) {
            throw new Error(`Could not find component ${componentId} in WML: ${wml}`)
        }
        return component
    }
}

