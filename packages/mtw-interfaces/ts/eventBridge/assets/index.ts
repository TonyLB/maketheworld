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

// Internal types for component events (no type; discrimination by header)
export type ComponentEventUpdate = ComponentUpdatedEvent | ComponentRepublishedEvent | ComponentRemovedEvent

export type ComponentUpdatedEvent = {
    component: StandardComponent
}

export type ComponentRepublishedEvent = {
    component: StandardComponent
}

export type ComponentRemovedEvent = {
    component: StandardComponent
}

// Type guards for component events (shape-based)
export const isComponentUpdatedEvent = (event: ComponentEventUpdate): event is ComponentUpdatedEvent => {
    return 'component' in event && isStandardComponent((event as any).component)
}

export const isComponentRemovedEvent = (event: ComponentEventUpdate): event is ComponentRemovedEvent => {
    return 'component' in event && isStandardComponent((event as any).component)
}

export const isAssetsComponentRepublishedEvent = (event: any): event is ComponentRepublishedEvent => {
    return event != null &&
        typeof event === 'object' &&
        'component' in event &&
        isStandardComponent(event.component)
}

export const isAssetsComponentUpdatedEvent = (event: any): event is ComponentUpdatedEvent => {
    return event != null &&
        typeof event === 'object' &&
        'component' in event &&
        isStandardComponent(event.component)
}

export const isAssetsComponentRemovedEvent = (event: any): event is ComponentRemovedEvent => {
    return event != null &&
        typeof event === 'object' &&
        'component' in event &&
        isStandardComponent(event.component)
}

export const isAssetsComponentEvent = (event: any): event is ComponentEventUpdate => {
    return isAssetsComponentUpdatedEvent(event) || isAssetsComponentRepublishedEvent(event) || isAssetsComponentRemovedEvent(event)
}

export const isAssetsLevelEvent = (event: AssetsEventUpdate): event is AssetLevelEventUpdate => {
    return isAssetAddedEvent(event) || isAssetCachedEvent(event) || isAssetDecachedEvent(event) ||
        isAssetRemovedEvent(event) || isCanonUpdatedEvent(event) || isZoneUpdatedEvent(event) || isAssetUpdatedEvent(event)
}

// Specific type guards for each asset-level event type (shape-based; zone-only events share shape, use header to discriminate)
export const isAssetAddedEvent = (event: any): event is AssetAddedEventUpdate => {
    return event != null && typeof event === 'object' && typeof event.zone === 'string' && !('fromZone' in event) && !('assetIds' in event) && !('standardForm' in event)
}

export const isAssetCachedEvent = (event: any): event is AssetCachedEventUpdate => {
    return event != null && typeof event === 'object' && typeof event.zone === 'string' && !('fromZone' in event) && !('assetIds' in event) && !('standardForm' in event)
}

export const isAssetDecachedEvent = (event: any): event is AssetDecachedEventUpdate => {
    return event != null && typeof event === 'object' && !('zone' in event) && !('fromZone' in event) && !('assetIds' in event) && !('standardForm' in event) && !('component' in event)
}

export const isAssetRemovedEvent = (event: any): event is AssetRemovedEventUpdate => {
    return event != null && typeof event === 'object' && typeof event.zone === 'string' && !('fromZone' in event) && !('assetIds' in event) && !('standardForm' in event)
}

export const isCanonUpdatedEvent = (event: any): event is CanonUpdatedEventUpdate => {
    return event != null && typeof event === 'object' && Array.isArray(event.assetIds)
}

export const isZoneUpdatedEvent = (event: any): event is ZoneUpdatedEventUpdate => {
    return event != null && typeof event === 'object' &&
           typeof event.fromZone === 'string' &&
           typeof event.toZone === 'string'
}

export const isAssetUpdatedEvent = (event: any): event is AssetUpdatedEventUpdate => {
    return event != null && typeof event === 'object' && event.standardForm instanceof StandardForm
}

export type ComponentEventExternal = ComponentUpdatedEventExternal | ComponentRemovedEventExternal

export type ComponentUpdatedEventExternal = {
    componentId: string
    wml: string // Serialized WML for external consumption
}

export type ComponentRemovedEventExternal = {
    componentId: string
    wml: string // Serialized WML for external consumption
}

// Union type for all internal event updates in mtw.assets
export type AssetsEventUpdate = ComponentEventUpdate | AssetLevelEventUpdate

// Specific asset-level event types (internal: no type; discrimination by header)
export type AssetAddedEventUpdate = {
    zone: string
    player?: string
}

export type AssetCachedEventUpdate = {
    zone: string
    wml?: string
}

export type AssetDecachedEventUpdate = Record<string, never>

export type AssetRemovedEventUpdate = {
    zone: string
    player?: string
}

export type CanonUpdatedEventUpdate = {
    assetIds: string[]
}

export type ZoneUpdatedEventUpdate = {
    fromZone: string
    toZone: string
    player?: string
}

export type AssetUpdatedEventUpdate = {
    standardForm: StandardForm
    player?: string
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
    zone: string
    player?: string  // Present for Personal and Draft zones
}

export type AssetCachedEventExternal = {
    zone: string
    wml?: string
}

export type AssetDecachedEventExternal = Record<string, never>

export type AssetRemovedEventExternal = {
    zone: string
    player?: string  // Present for Personal and Draft zones
}

export type CanonUpdatedEventExternal = {
    assetIds: string[]
}

export type ZoneUpdatedEventExternal = {
    fromZone: string
    toZone: string
    player?: string  // Present for Personal and Draft zones (in fromZone or toZone)
}

export type AssetUpdatedEventExternal = {
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
const isComponentRepublishedAssetsSerializeParams = (p: AssetsSerializeParams): p is AssetsSerializeParams & { header: StreamingEventHeader & { type: 'Component Republished' }; content: ComponentRepublishedEvent } =>
    p.header.type === 'Component Republished'
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
const isComponentRepublishedAssetsDeserializeParams = (p: AssetsDeserializeParams): p is AssetsDeserializeParams & { header: StreamingEventHeader & { type: 'Component Republished' }; content: ComponentUpdatedEventExternal } =>
    p.header.type === 'Component Republished'
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
        if (params.header?.type === 'Snapshot') {
            throw new Error('AssetsEventSerializer does not support snapshot serialization')
        }
        if (isComponentUpdatedAssetsSerializeParams(params)) {
            const { content } = params
            return {
                componentId: content.component.universalKey || '',
                wml: schemaToWML([content.component.schema])
            }
        }
        if (isComponentRepublishedAssetsSerializeParams(params)) {
            const { content } = params
            return {
                componentId: content.component.universalKey || '',
                wml: schemaToWML([content.component.schema])
            }
        }
        if (isComponentRemovedAssetsSerializeParams(params)) {
            const { content } = params
            return {
                componentId: content.component.universalKey || '',
                wml: schemaToWML([content.component.schema])
            }
        }
        if (isAssetUpdatedAssetsSerializeParams(params)) {
            const { content } = params
            return {
                wml: schemaToWML([content.standardForm.schema]),
                ...(content.player ? { player: content.player } : {})
            }
        }
        if (isAssetAddedAssetsSerializeParams(params)) {
            const { content } = params
            return { zone: content.zone, ...(content.player != null ? { player: content.player } : {}) }
        }
        if (isAssetCachedAssetsSerializeParams(params)) {
            const { content } = params
            return { zone: content.zone, ...(content.wml != null ? { wml: content.wml } : {}) }
        }
        if (isAssetDecachedAssetsSerializeParams(params)) return {}
        if (isAssetRemovedAssetsSerializeParams(params)) {
            const { content } = params
            return { zone: content.zone, ...(content.player != null ? { player: content.player } : {}) }
        }
        if (isCanonUpdatedAssetsSerializeParams(params)) {
            const { content } = params
            return { assetIds: content.assetIds }
        }
        if (isZoneUpdatedAssetsSerializeParams(params)) {
            const { content } = params
            return { fromZone: content.fromZone, toZone: content.toZone, ...(content.player != null ? { player: content.player } : {}) }
        }
        throw new Error(`Unknown event type in AssetsEventUpdate: ${params.header.type}`)
    }

    async deserialize(params: AssetsDeserializeParams): Promise<AssetsEventUpdate | null> {
        if (params.header?.type === 'Snapshot') {
            return null
        }
        if (isComponentUpdatedAssetsDeserializeParams(params)) {
            const { content } = params
            return {
                component: this.parseWMLToComponent(content.wml, content.componentId)
            }
        }
        if (isComponentRepublishedAssetsDeserializeParams(params)) {
            const { content } = params
            return {
                component: this.parseWMLToComponent(content.wml, content.componentId)
            }
        }
        if (isComponentRemovedAssetsDeserializeParams(params)) {
            const { content } = params
            return {
                component: this.parseWMLToComponent(content.wml, content.componentId)
            }
        }
        if (isAssetUpdatedAssetsDeserializeParams(params)) {
            const { content } = params
            return {
                standardForm: new StandardForm(content.wml),
                ...(content.player ? { player: content.player } : {})
            }
        }
        if (isAssetAddedAssetsDeserializeParams(params)) {
            const { content } = params
            return { zone: content.zone, ...(content.player != null ? { player: content.player } : {}) }
        }
        if (isAssetCachedAssetsDeserializeParams(params)) {
            const { content } = params
            return { zone: content.zone, ...(content.wml != null ? { wml: content.wml } : {}) }
        }
        if (isAssetDecachedAssetsDeserializeParams(params)) return {}
        if (isAssetRemovedAssetsDeserializeParams(params)) {
            const { content } = params
            return { zone: content.zone, ...(content.player != null ? { player: content.player } : {}) }
        }
        if (isCanonUpdatedAssetsDeserializeParams(params)) {
            const { content } = params
            return { assetIds: content.assetIds }
        }
        if (isZoneUpdatedAssetsDeserializeParams(params)) {
            const { content } = params
            return { fromZone: content.fromZone, toZone: content.toZone, ...(content.player != null ? { player: content.player } : {}) }
        }
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

// Re-export library and componentExamples data source contracts
export * from './library'
export * from './componentExamples'
export * from './componentExamplesSerializer'
export * from './componentTopology'
export * from './componentTopologySerializer'