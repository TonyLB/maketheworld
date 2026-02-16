/**
 * mtw.assets.contentHeaders DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Component Updated, Component Removed, Asset Updated; mtw.wml: Zone Changed).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ComponentEventUpdate, ComponentUpdatedEvent, ComponentRemovedEvent, AssetUpdatedEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { WMLZoneEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

export type ContentHeadersIncomingEvent =
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' };
          getContentInternal: () => Promise<ComponentUpdatedEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' };
          getContentInternal: () => Promise<ComponentRemovedEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' };
          getContentInternal: () => Promise<AssetUpdatedEventUpdate>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' };
          getContentInternal: () => Promise<WMLZoneEvent>;
      };

export type SubscribedAssetsContent = ComponentEventUpdate | AssetUpdatedEventUpdate
export type SubscribedWMLContent = WMLZoneEvent

/** Payload types of events mtw.assets.contentHeaders subscribes to (derived from envelope union). */
export type ContentHeadersSubscribedContent = ComponentUpdatedEvent | ComponentRemovedEvent | AssetUpdatedEventUpdate | WMLZoneEvent

const isZoneChangedContentHeadersHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Zone Changed'
const isComponentHeadersHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' | 'Component Removed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' | 'Component Removed' } =>
    h.dataSourceKey === 'mtw.assets' && (h.type === 'Component Updated' || h.type === 'Component Removed')
const isAssetUpdatedHeadersHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Asset Updated'

export const isZoneChangedContentHeadersEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLZoneEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }>(isZoneChangedContentHeadersHeader)
export const isComponentHeadersEvent = makeStreamingEnvelopeGuardFromHeaderGuard<ComponentUpdatedEvent | ComponentRemovedEvent, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' | 'Component Removed' }>(isComponentHeadersHeader)
export const isAssetUpdatedHeadersEvent = makeStreamingEnvelopeGuardFromHeaderGuard<AssetUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' }>(isAssetUpdatedHeadersHeader)

export const isSubscribedEventHeader: HeaderGuard<StreamingEventHeader> = (header): header is StreamingEventHeader =>
    isZoneChangedContentHeadersHeader(header) ||
    isComponentHeadersHeader(header) ||
    isAssetUpdatedHeadersHeader(header)

export const isContentHeadersSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ContentHeadersSubscribedContent, StreamingEventHeader>(isSubscribedEventHeader)
