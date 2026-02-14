/**
 * mtw.assets.library DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Zone Updated, Asset Cached, Asset Removed).
 */
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ZoneUpdatedEventUpdate, AssetCachedEventUpdate, AssetRemovedEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

export type LibraryIncomingEvent =
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' };
          getContentInternal: () => Promise<ZoneUpdatedEventUpdate>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Cached' };
          getContentInternal: () => Promise<AssetCachedEventUpdate>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' };
          getContentInternal: () => Promise<AssetRemovedEventUpdate>;
      };

export const LIBRARY_EVENT_TYPES = new Set(['Zone Updated', 'Asset Cached', 'Asset Removed'])

export const isZoneUpdatedLibraryEvent = (event: LibraryIncomingEvent): event is Extract<
    LibraryIncomingEvent,
    { header: { type: 'Zone Updated' } }
> => (
    event.header.dataSourceKey === 'mtw.assets' &&
    event.header.type === 'Zone Updated'
)

export const isAssetCachedLibraryEvent = (event: LibraryIncomingEvent): event is Extract<
    LibraryIncomingEvent,
    { header: { type: 'Asset Cached' } }
> => (
    event.header.dataSourceKey === 'mtw.assets' &&
    event.header.type === 'Asset Cached'
)

export const isAssetRemovedLibraryEvent = (event: LibraryIncomingEvent): event is Extract<
    LibraryIncomingEvent,
    { header: { type: 'Asset Removed' } }
> => (
    event.header.dataSourceKey === 'mtw.assets' &&
    event.header.type === 'Asset Removed'
)

export const isSubscribedAssetsEventHeader = (header: StreamingEventHeader): boolean => {
    return header.dataSourceKey === 'mtw.assets' && LIBRARY_EVENT_TYPES.has(header.type)
}

export type LibrarySubscribedContent = ZoneUpdatedEventUpdate | AssetCachedEventUpdate | AssetRemovedEventUpdate

export function isLibrarySubscribedEnvelope(e: StreamingEventEnvelope<unknown>): e is StreamingEventEnvelope<LibrarySubscribedContent> {
    return e.header.dataSourceKey === 'mtw.assets' && LIBRARY_EVENT_TYPES.has(e.header.type)
}
