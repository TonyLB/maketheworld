// Re-export types from mtw-interfaces
// The canonical definitions now live in mtw-interfaces for client reuse
export type {
    ContentHeadersEventUpdate,
    ContentHeadersSnapshot,
    ContentHeadersUpdate,
    ZoneUpdatedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'

export {
    isContentHeadersSnapshot,
    isContentHeadersUpdate,
    isZoneUpdatedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'