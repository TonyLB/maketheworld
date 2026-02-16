/**
 * mtw.assets.library DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Zone Updated, Asset Cached, Asset Removed).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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

const isZoneUpdatedLibraryHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Zone Updated'
const isAssetCachedLibraryHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Cached' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Cached' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Asset Cached'
const isAssetRemovedLibraryHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Asset Removed'

export const isZoneUpdatedLibraryEvent = makeStreamingEnvelopeGuardFromHeaderGuard<ZoneUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }>(isZoneUpdatedLibraryHeader)
export const isAssetCachedLibraryEvent = makeStreamingEnvelopeGuardFromHeaderGuard<AssetCachedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Cached' }>(isAssetCachedLibraryHeader)
export const isAssetRemovedLibraryEvent = makeStreamingEnvelopeGuardFromHeaderGuard<AssetRemovedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' }>(isAssetRemovedLibraryHeader)

export const isSubscribedAssetsEventHeader: HeaderGuard<StreamingEventHeader> = (header): header is StreamingEventHeader =>
    isZoneUpdatedLibraryHeader(header) ||
    isAssetCachedLibraryHeader(header) ||
    isAssetRemovedLibraryHeader(header)

export type LibrarySubscribedContent = ZoneUpdatedEventUpdate | AssetCachedEventUpdate | AssetRemovedEventUpdate

export const isLibrarySubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<LibrarySubscribedContent, StreamingEventHeader>(isSubscribedAssetsEventHeader)
