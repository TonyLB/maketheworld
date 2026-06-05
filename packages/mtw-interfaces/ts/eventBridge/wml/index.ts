// WML Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the WML data source.
// Migrated from lambda/wml/dataSource/serializers.ts

import { DataSourceEventSerializer, StreamingEventHeader, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ResolvedStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { maybeFetchSidecarString } from '@tonylb/mtw-lambda-patterns/ts/dataSource/sidecarResolve'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

/**
 * Extended header for mtw.wml. RequestIds is envelope-level only (client edit correlation), not in content.
 * Non-empty only when the triggering Apply Edit carried RequestId (client optimistic save resolved).
 * Omitted or [] on Zone Changed, Snapshot Created, Asset Purged, server-side applies, and primitives bootstrap.
 */
export type WMLStreamingEventHeader = StreamingEventHeader & { RequestIds?: string[] }

// Internal types for WML events (no type field; discrimination by envelope.header.type only).
// Content Update: carries edit/delta (not full document). Consumers must merge onto current state.
// RequestIds is carried in the envelope header only (WMLStreamingEventHeader), not in content.
export type WMLContentEvent =
    | { schema: StandardForm }
    | { error?: string }

export type WMLZoneEvent = {
    fromZone: Zone
    toZone: Zone
    player?: string
    subFolder?: string
}

export type WMLSnapshotEvent = {
    chunksBeforeSnapshot: number
    snapshotSize: number
}

export type WMLPurgeEvent = {
    zone: 'Draft' | 'Archive'
    objectsDeleted: number
    player?: string  // Present for Draft zone (Personal assets are not purgeable)
}

// Union type for all internal WML events
export type WMLEventUpdate = WMLContentEvent | WMLZoneEvent | WMLSnapshotEvent | WMLPurgeEvent

// External types for WML events.
// Content Update: wml is edit/delta WML (inline string) or sidecar descriptor { sidecarUrl: string }.
// Consumers must merge onto current state. RequestIds is in Detail.extendedHeader (header), not in payload.
export type WMLContentEventExternal =
    | { wml: string }
    | { wml: { sidecarUrl: string } }
    | { error?: string }

export type WMLZoneEventExternal = {
    fromZone: Zone
    toZone: Zone
    player?: string
    subFolder?: string
}

export type WMLSnapshotEventExternal = {
    chunksBeforeSnapshot: number
    snapshotSize: number
}

export type WMLPurgeEventExternal = {
    zone: 'Draft' | 'Archive'
    objectsDeleted: number
    player?: string  // Present for Draft zone (Personal assets are not purgeable)
}

// Union type for all external WML events
export type WMLEventExternal = WMLContentEventExternal | WMLZoneEventExternal | WMLSnapshotEventExternal | WMLPurgeEventExternal

// External type guard for WML EventBridge payloads (shape-based; type optional)
export const isWMLContentEventExternal = (event: any): event is WMLContentEventExternal => {
    if (!event || typeof event !== 'object') {
        return false
    }
    // Content Update: wml is inline string
    if (typeof (event as any).wml === 'string') {
        return true
    }
    // Content Update: wml is sidecar descriptor
    if (
        typeof (event as any).wml === 'object' &&
        (event as any).wml != null &&
        'sidecarUrl' in (event as any).wml &&
        typeof (event as any).wml.sidecarUrl === 'string'
    ) {
        return true
    }
    // Merge Conflict: no wml, optional error
    if (!('wml' in event)) {
        return true
    }
    return false
}

export const isWMLContentUpdateEvent = (event: any): event is WMLContentEvent & { schema: StandardForm } => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'schema' in event &&
        event.schema instanceof StandardForm
    )
}

export const isWMLMergeConflictEvent = (event: any): event is WMLContentEvent & { error?: string } => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        !('schema' in event && event.schema instanceof StandardForm)
    )
}

// Type guard for internal content union (shape-based)
export const isWMLContentEvent = (event: any): event is WMLContentEvent =>
    isWMLContentUpdateEvent(event) || isWMLMergeConflictEvent(event)

// Envelope type guards for WML content events (narrow both header and content; no casts in aggregator)
export type WMLContentEnvelope = ResolvedStreamingEnvelope<WMLContentEvent, WMLStreamingEventHeader>

export function isWMLMergeConflictEnvelope(
    envelope: WMLContentEnvelope
): envelope is ResolvedStreamingEnvelope<WMLContentEvent & { error?: string }, WMLStreamingEventHeader & { type: 'Merge Conflict' }> {
    return envelope.header.type === 'Merge Conflict'
}

export function isWMLContentUpdateEnvelope(
    envelope: WMLContentEnvelope
): envelope is ResolvedStreamingEnvelope<WMLContentEvent & { schema: StandardForm }, WMLStreamingEventHeader & { type: 'Content Update' }> {
    return envelope.header.type === 'Content Update'
}

export const isWMLZoneEvent = (event: any): event is WMLZoneEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'fromZone' in event &&
        'toZone' in event &&
        typeof event.fromZone === 'string' &&
        typeof event.toZone === 'string' &&
        isZone(event.fromZone) &&
        isZone(event.toZone)
    )
}

export const isWMLSnapshotEvent = (event: any): event is WMLSnapshotEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        typeof event.chunksBeforeSnapshot === 'number' &&
        typeof event.snapshotSize === 'number'
    )
}

export const isWMLPurgeEvent = (event: any): event is WMLPurgeEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        typeof event.zone === 'string' &&
        (event.zone === 'Draft' || event.zone === 'Archive') &&
        typeof event.objectsDeleted === 'number'
    )
}

/**
 * Aggregator for WML dataSource slice: materialized view is StandardFormData;
 * Content Update events merge delta onto view; Merge Conflict leaves view unchanged.
 */
export class WMLAggregator implements DataSourceAggregator<StandardFormData, WMLContentEvent> {
    createEmpty(streamKey: string): StandardFormData {
        const universalKey = AssetKey(streamKey)
        return {
            universalKey,
            components: [],
            metaData: []
        }
    }

    applyUpdate(view: StandardFormData, envelope: WMLContentEnvelope): { success: true; snapshot: StandardFormData } | { success: false; error: Error; snapshot: StandardFormData } {
        if (isWMLMergeConflictEnvelope(envelope)) {
            const errMsg = envelope.content.error ?? 'Merge conflict'
            return { success: false, error: new Error(errMsg), snapshot: view }
        }
        if (isWMLContentUpdateEnvelope(envelope)) {
            const current = new StandardForm(view)
            const merged = current.merge(envelope.content.schema)
            return { success: true, snapshot: merged.toJSON() }
        }
        return { success: false, error: new Error('Expected Content Update when header is not Merge Conflict'), snapshot: view }
    }
}

/**
 * Type guard for materialized view (StandardFormData) in recentEvents.
 * Used by WML dataSource slice to distinguish snapshot from update events.
 */
export const isWMLMaterializedView = (event: any): event is StandardFormData => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'universalKey' in event &&
        'components' in event &&
        Array.isArray(event.components) &&
        'metaData' in event
    )
}

// Serialize/deserialize params - use ResolvedStreamingEnvelope so header discriminates content shape; header may carry RequestIds
type WMLSerializeParams = ResolvedStreamingEnvelope<WMLEventUpdate, WMLStreamingEventHeader>
type WMLDeserializeParams = ResolvedStreamingEnvelope<WMLEventExternal, WMLStreamingEventHeader>

// Envelope type guards for serialize (header.type narrows content)
const isZoneChangedWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Zone Changed' }; content: WMLZoneEvent } =>
    p.header.type === 'Zone Changed'
const isSnapshotCreatedWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Snapshot Created' }; content: WMLSnapshotEvent } =>
    p.header.type === 'Snapshot Created'
const isContentUpdateWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: WMLStreamingEventHeader & { type: 'Content Update' }; content: WMLContentEvent & { schema: StandardForm } } =>
    p.header.type === 'Content Update'
const isMergeConflictWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: WMLStreamingEventHeader & { type: 'Merge Conflict' }; content: WMLContentEvent & { error?: string } } =>
    p.header.type === 'Merge Conflict'
const isAssetPurgedWMLSerializeParams = (p: WMLSerializeParams): p is WMLSerializeParams & { header: StreamingEventHeader & { type: 'Asset Purged' }; content: WMLPurgeEvent } =>
    p.header.type === 'Asset Purged'

// Envelope type guards for deserialize (header.type narrows content)
const isZoneChangedWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Zone Changed' }; content: WMLZoneEventExternal } =>
    p.header.type === 'Zone Changed'
const isSnapshotCreatedWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Snapshot Created' }; content: WMLSnapshotEventExternal } =>
    p.header.type === 'Snapshot Created'
const isContentUpdateWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: WMLStreamingEventHeader & { type: 'Content Update' }; content: { wml: string | { sidecarUrl: string } } } =>
    p.header.type === 'Content Update'
const isMergeConflictWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: WMLStreamingEventHeader & { type: 'Merge Conflict' }; content: { error?: string } } =>
    p.header.type === 'Merge Conflict'
const isAssetPurgedWMLDeserializeParams = (p: WMLDeserializeParams): p is WMLDeserializeParams & { header: StreamingEventHeader & { type: 'Asset Purged' }; content: WMLPurgeEventExternal } =>
    p.header.type === 'Asset Purged'

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
export class WMLEventSerializer implements DataSourceEventSerializer<WMLEventUpdate, WMLEventExternal, SerializableObject, SerializableObject, WMLStreamingEventHeader> {
    constructor(private readonly env: DataSourceEnvironment) {}

    /**
     * Serialize an internal event to external format
     * for EventBridge transmission
     */
    serialize(params: WMLSerializeParams): WMLEventExternal {
        if (params.header?.type === 'Snapshot') {
            const { content } = params
            const snapshotContent = content as { wml: string | { sidecarUrl: string } }
            return { wml: snapshotContent.wml } as WMLEventExternal
        }
        if (isZoneChangedWMLSerializeParams(params)) {
            const { content } = params
            return { fromZone: content.fromZone, toZone: content.toZone, ...(content.player != null ? { player: content.player } : {}), ...(content.subFolder != null ? { subFolder: content.subFolder } : {}) }
        }
        if (isSnapshotCreatedWMLSerializeParams(params)) {
            const { content } = params
            return { chunksBeforeSnapshot: content.chunksBeforeSnapshot, snapshotSize: content.snapshotSize }
        }
        if (isContentUpdateWMLSerializeParams(params)) {
            const { content } = params
            return {
                wml: schemaToWML([content.schema.schema])
            }
        }
        if (isMergeConflictWMLSerializeParams(params)) {
            const { content } = params
            return {
                error: content.error
            }
        }
        if (isAssetPurgedWMLSerializeParams(params)) {
            const { content } = params
            return {
                zone: content.zone,
                objectsDeleted: content.objectsDeleted,
                ...(content.player != null ? { player: content.player } : {})
            }
        }
        throw new Error(`Unknown WML event type: ${params.header.type}`)
    }


    /**
     * Deserialize an external event back to internal format
     * for messageBus processing
     */
    async deserialize(params: WMLDeserializeParams): Promise<WMLEventUpdate | null> {
        if (params.header?.type === 'Snapshot') {
            // Temporary expedient until mtw.wml refactor with streamEnvelope for storing snapshots into Dynamo.
            // Today the backend loads from store and passes through the claim-check (identity) since it does not
            // need the fetched WML. Once we use streamEnvelope for snapshot storage, the only callers of
            // deserialize will be those that actually want the fetched data (e.g. client slice); those will
            // resolve sidecars via maybeFetchSidecarString. This backend path can then be removed or updated.
            const { content } = params
            return content as unknown as WMLEventUpdate
        }
        if (isZoneChangedWMLDeserializeParams(params)) {
            const { content } = params
            return { fromZone: content.fromZone, toZone: content.toZone, ...(content.player != null ? { player: content.player } : {}), ...(content.subFolder != null ? { subFolder: content.subFolder } : {}) }
        }
        if (isSnapshotCreatedWMLDeserializeParams(params)) {
            const { content } = params
            return { chunksBeforeSnapshot: content.chunksBeforeSnapshot, snapshotSize: content.snapshotSize }
        }
        if (isContentUpdateWMLDeserializeParams(params)) {
            const { content } = params
            if (content.wml === undefined || content.wml === null) {
                throw new Error(`Content Update event missing required 'wml' property`)
            }
            try {
                const wml = await maybeFetchSidecarString(content.wml, this.env.fetch)
                const schemaNode = nodeFromWML(wml)
                const standardForm = new StandardForm(schemaNode)
                return { schema: standardForm }
            } catch (error) {
                throw new Error(`Failed to deserialize WML: ${error instanceof Error ? error.message : String(error)}`)
            }
        }
        if (isMergeConflictWMLDeserializeParams(params)) {
            const { content } = params
            return { error: content.error }
        }
        if (isAssetPurgedWMLDeserializeParams(params)) {
            const { content } = params
            return { zone: content.zone, objectsDeleted: content.objectsDeleted, ...(content.player != null ? { player: content.player } : {}) }
        }
        throw new Error(`Unknown external WML event type: ${JSON.stringify(params.content)}`)
    }

    // Snapshot handling: serialize/deserialize pass through domain-shaped { wml: string | { sidecarUrl } }.
    // Backend uses identity for store load/caching; client slice uses WMLDataSourceEventSerializer.
}

/**
 * Event serializer for the WML dataSource slice (mtw.wml).
 * Only content events (Content Update, Merge Conflict) are deserialized; other event types return null.
 * Snapshots use a WML-centric external payload shape `{ wml: string }`, which is parsed into StandardForm
 * and converted to StandardFormData at the snapshot boundary before being stored in Redux.
 */
export class WMLDataSourceEventSerializer implements DataSourceEventSerializer<WMLContentEvent, WMLContentEventExternal, StandardFormData, { wml: string | { sidecarUrl: string } }, WMLStreamingEventHeader> {
    private readonly baseSerializer: WMLEventSerializer

    constructor(private readonly env: DataSourceEnvironment) {
        this.baseSerializer = new WMLEventSerializer(env)
    }

    serialize(params: { content: WMLContentEvent; header: WMLStreamingEventHeader }): WMLContentEventExternal {
        if (params.header?.type === 'Snapshot') {
            throw new Error('WMLDataSourceEventSerializer does not support snapshot serialization')
        }
        return this.baseSerializer.serialize(params) as WMLContentEventExternal
    }

    async deserialize(params: { content: WMLContentEventExternal; header: WMLStreamingEventHeader }): Promise<WMLContentEvent | null> {
        if (params.header?.type === 'Snapshot') {
            const externalSnapshot = params.content as { wml: string | { sidecarUrl: string } }
            try {
                const wml = await maybeFetchSidecarString(externalSnapshot.wml, this.env.fetch)
                const standardForm = new StandardForm(wml)
                return standardForm.toJSON() as WMLContentEvent
            } catch (error) {
                console.error('[WMLDataSourceEventSerializer] Failed to deserialize snapshot WML', error)
                return null
            }
        }
        // Route on header: only Content Update and Merge Conflict are accepted for this slice
        if (params.header.type !== 'Content Update' && params.header.type !== 'Merge Conflict') {
            return null
        }
        const result = await this.baseSerializer.deserialize(params)
        if (result && isWMLContentEvent(result)) {
            return result
        }
        return null
    }
}