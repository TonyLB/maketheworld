import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

// Internal types for content headers events (using StandardForm objects)
export type ContentHeadersEventUpdate = ContentHeadersSnapshot | ContentHeadersUpdate

export type ContentHeadersSnapshot = {
    type: 'Snapshot Generated'
    assets: Array<{
        assetId: AssetUUID
        zone: 'Canon' | 'Library' | 'Personal'
        standardForm: StandardForm // Internal representation for manipulation
    }>
}

export type ContentHeadersUpdate = {
    type: 'Headers Updated'
    assetId: AssetUUID
    zone: 'Canon' | 'Library' | 'Personal'
    standardForm: StandardForm // Internal representation for manipulation
}

// Type guards for content headers events
export const isContentHeadersSnapshot = (event: ContentHeadersEventUpdate): event is ContentHeadersSnapshot => {
    return event.type === 'Snapshot Generated'
}

export const isContentHeadersUpdate = (event: ContentHeadersEventUpdate): event is ContentHeadersUpdate => {
    return event.type === 'Headers Updated'
}
