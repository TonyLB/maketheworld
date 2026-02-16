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

export const isZoneChangedContentHeadersEvent = (event: ContentHeadersIncomingEvent): event is Extract<
    ContentHeadersIncomingEvent,
    { header: { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } }
> => (
    event.header.dataSourceKey === 'mtw.wml' &&
    event.header.type === 'Zone Changed'
)

export const isComponentHeadersEvent = (event: ContentHeadersIncomingEvent): event is Extract<
    ContentHeadersIncomingEvent,
    { header: { dataSourceKey: 'mtw.assets'; type: 'Component Updated' | 'Component Removed' } }
> => (
    event.header.dataSourceKey === 'mtw.assets' &&
    (event.header.type === 'Component Updated' || event.header.type === 'Component Removed')
)

export const isAssetUpdatedHeadersEvent = (event: ContentHeadersIncomingEvent): event is Extract<
    ContentHeadersIncomingEvent,
    { header: { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' } }
> => (
    event.header.dataSourceKey === 'mtw.assets' &&
    event.header.type === 'Asset Updated'
)

export const isSubscribedEventHeader: HeaderGuard<StreamingEventHeader> = (header: StreamingEventHeader): header is StreamingEventHeader => {
    if (header.dataSourceKey === 'mtw.assets') {
        return ['Component Updated', 'Component Removed', 'Asset Updated'].includes(header.type)
    }
    if (header.dataSourceKey === 'mtw.wml') {
        return header.type === 'Zone Changed'
    }
    return false
}

export const isContentHeadersSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ContentHeadersSubscribedContent, StreamingEventHeader>(isSubscribedEventHeader)
