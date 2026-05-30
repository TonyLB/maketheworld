import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ComponentUpdatedEvent, ComponentRemovedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

export type ComponentTopologyIncomingEvent =
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' };
          getContent: () => Promise<ComponentUpdatedEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' };
          getContent: () => Promise<ComponentRemovedEvent>;
      };

export type ComponentTopologySubscribedContent = ComponentUpdatedEvent | ComponentRemovedEvent

export type ComponentTopologySubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' })

const isComponentTopologySubscribedHeader: HeaderGuard<ComponentTopologySubscribedHeader> = (
    h
): h is ComponentTopologySubscribedHeader =>
    h.dataSourceKey === 'mtw.assets' &&
    (h.type === 'Component Updated' || h.type === 'Component Removed')

export const isComponentTopologySubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ComponentTopologySubscribedContent,
    ComponentTopologySubscribedHeader
>(isComponentTopologySubscribedHeader)
