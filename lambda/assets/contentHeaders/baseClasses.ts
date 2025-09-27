import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { Zone, isZone } from '@tonylb/mtw-interfaces/ts/baseClasses'

// Internal types for content headers events (using StandardForm objects)
export type ContentHeadersEventUpdate = ContentHeadersSnapshot | ContentHeadersUpdate | ZoneUpdatedEvent

export type ContentHeadersSnapshot = {
    type: 'Snapshot Generated'
    assets: Array<{
        assetId: AssetUUID
        zone: Zone
        standardForm: StandardForm // Internal representation for manipulation
    }>
}

export type ContentHeadersUpdate = {
    type: 'Headers Updated'
    assetId: AssetUUID
    zone: Zone
    standardForm: StandardForm // Internal representation for manipulation
}

// Type guards for content headers events
export const isContentHeadersSnapshot = (event: any): event is ContentHeadersSnapshot => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Snapshot Generated' &&
        'assets' in event &&
        Array.isArray(event.assets)
    )
}

export const isContentHeadersUpdate = (event: any): event is ContentHeadersUpdate => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Headers Updated' &&
        'assetId' in event &&
        'zone' in event &&
        'standardForm' in event &&
        typeof event.assetId === 'string' &&
        isZone(event.zone)
    )
}

export type ZoneUpdatedEvent = {
    type: 'Zone Updated'
    assetId: AssetUUID
    fromZone: Zone
    toZone: Zone
}

// Type guards for zone updated events
export const isZoneUpdatedEvent = (event: any): event is ZoneUpdatedEvent => {
    return Boolean(
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'Zone Updated' &&
        'assetId' in event &&
        'fromZone' in event &&
        'toZone' in event &&
        typeof event.assetId === 'string' &&
        isZone(event.fromZone) &&
        isZone(event.toZone)
    )
}