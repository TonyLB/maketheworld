// Assets Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Assets data source.
// Migrated from lambda/assets/dataSource/serializers.ts

import { DataSourceEventSerializer, ResolvedStreamingEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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

// Serialize/deserialize params - use ResolvedStreamingEnvelope so header discriminates content shape
type AssetsSerializeParams = ResolvedStreamingEnvelope<AssetsEventUpdate, StreamingEventHeader>
type AssetsDeserializeParams = ResolvedStreamingEnvelope<AssetsEventExternal, StreamingEventHeader>

// Envelope type guards for serialize (header.type narrows content)
const isComponentUpdatedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Component Updated' }; content: ComponentUpdatedEvent } =>
    p.header.type === 'Component Updated'
const isComponentRemovedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Component Removed' }; content: ComponentRemovedEvent } =>
    p.header.type === 'Component Removed'
const isAssetUpdatedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Asset Updated' }; content: AssetUpdatedEventUpdate } =>
    p.header.type === 'Asset Updated'
const isAssetAddedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Asset Added' }; content: AssetAddedEventUpdate } =>
    p.header.type === 'Asset Added'
const isAssetCachedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Asset Cached' }; content: AssetCachedEventUpdate } =>
    p.header.type === 'Asset Cached'
const isAssetDecachedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Asset Decached' }; content: AssetDecachedEventUpdate } =>
    p.header.type === 'Asset Decached'
const isAssetRemovedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Asset Removed' }; content: AssetRemovedEventUpdate } =>
    p.header.type === 'Asset Removed'
const isCanonUpdatedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Canon Updated' }; content: CanonUpdatedEventUpdate } =>
    p.header.type === 'Canon Updated'
const isZoneUpdatedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Zone Updated' }; content: ZoneUpdatedEventUpdate } =>
    p.header.type === 'Zone Updated'

// Envelope type guards for deserialize (header.type narrows content)
const isComponentUpdatedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Component Updated' }; content: ComponentUpdatedEventExternal } =>
    p.header.type === 'Component Updated'
const isComponentRemovedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Component Removed' }; content: ComponentRemovedEventExternal } =>
    p.header.type === 'Component Removed'
const isAssetUpdatedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Updated' }; content: AssetUpdatedEventExternal } =>
    p.header.type === 'Asset Updated'
const isAssetAddedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Added' }; content: AssetAddedEventExternal } =>
    p.header.type === 'Asset Added'
const isAssetCachedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Cached' }; content: AssetCachedEventExternal } =>
    p.header.type === 'Asset Cached'
const isAssetDecachedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Decached' }; content: AssetDecachedEventExternal } =>
    p.header.type === 'Asset Decached'
const isAssetRemovedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Removed' }; content: AssetRemovedEventExternal } =>
    p.header.type === 'Asset Removed'
const isCanonUpdatedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Canon Updated' }; content: CanonUpdatedEventExternal } =>
    p.header.type === 'Canon Updated'
const isZoneUpdatedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Zone Updated' }; content: ZoneUpdatedEventExternal } =>
    p.header.type === 'Zone Updated'

/**
 * Unified event serializer for the mtw.assets data source.
 *
 * This serializer intelligently handles different types of events based on their detailType metadata:
 * - Component events: Converts StandardComponent objects to WML for external consumption
 * - Asset-level events: Passes through data as-is
 */
export class AssetsEventSerializer implements DataSourceEventSerializer<AssetsEventUpdate, AssetsEventExternal> {
    serialize(params: AssetsSerializeParams): AssetsEventExternal {
        if (isComponentUpdatedAssetsSerializeParams(params)) {
            const { content } = params
            const base = {
                componentId: content.component.universalKey || '',
                wml: schemaToWML([content.component.schema])
            }
            return { type: 'Component Updated', ...base }
        }
        if (isComponentRemovedAssetsSerializeParams(params)) {
            const { content } = params
            const base = {
                componentId: content.component.universalKey || '',
                wml: schemaToWML([content.component.schema])
            }
            return { type: 'Component Removed', ...base }
        }
        if (isAssetUpdatedAssetsSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Asset Updated',
                wml: schemaToWML([content.standardForm.schema]),
                ...(content.player ? { player: content.player } : {})
            }
        }
        if (isAssetAddedAssetsSerializeParams(params)) return params.content
        if (isAssetCachedAssetsSerializeParams(params)) return params.content
        if (isAssetDecachedAssetsSerializeParams(params)) return params.content
        if (isAssetRemovedAssetsSerializeParams(params)) return params.content
        if (isCanonUpdatedAssetsSerializeParams(params)) return params.content
        if (isZoneUpdatedAssetsSerializeParams(params)) return params.content
        throw new Error(`Unknown event type in AssetsEventUpdate: ${params.header.type}`)
    }

    deserialize(params: AssetsDeserializeParams): AssetsEventUpdate | null {
        if (isComponentUpdatedAssetsDeserializeParams(params)) {
            const { content } = params
            return {
                type: 'Component Updated',
                component: this.parseWMLToComponent(content.wml, content.componentId)
            }
        }
        if (isComponentRemovedAssetsDeserializeParams(params)) {
            const { content } = params
            return {
                type: 'Component Removed',
                component: this.parseWMLToComponent(content.wml, content.componentId)
            }
        }
        if (isAssetUpdatedAssetsDeserializeParams(params)) {
            const { content } = params
            return {
                type: 'Asset Updated',
                standardForm: new StandardForm(content.wml),
                ...(content.player ? { player: content.player } : {})
            }
        }
        if (isAssetAddedAssetsDeserializeParams(params)) return params.content
        if (isAssetCachedAssetsDeserializeParams(params)) return params.content
        if (isAssetDecachedAssetsDeserializeParams(params)) return params.content
        if (isAssetRemovedAssetsDeserializeParams(params)) return params.content
        if (isCanonUpdatedAssetsDeserializeParams(params)) return params.content
        if (isZoneUpdatedAssetsDeserializeParams(params)) return params.content
        return null
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