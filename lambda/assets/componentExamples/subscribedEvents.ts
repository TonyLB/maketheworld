/**
 * mtw.assets.componentExamples DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Component Updated, Component Republished, Component Removed).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ComponentRepublishedEvent, ComponentUpdatedEvent, ComponentRemovedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

export type ComponentExamplesIncomingEvent =
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' };
          getContent: () => Promise<ComponentUpdatedEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Republished' };
          getContent: () => Promise<ComponentRepublishedEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' };
          getContent: () => Promise<ComponentRemovedEvent>;
      };

/** Payload types of events mtw.assets.componentExamples subscribes to. */
export type ComponentExamplesSubscribedContent = ComponentUpdatedEvent | ComponentRepublishedEvent | ComponentRemovedEvent

/** Header union for events mtw.assets.componentExamples subscribes to. */
export type ComponentExamplesSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Republished' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' })

const isComponentExamplesSubscribedHeader: HeaderGuard<ComponentExamplesSubscribedHeader> = (
    h
): h is ComponentExamplesSubscribedHeader =>
    h.dataSourceKey === 'mtw.assets' &&
    (h.type === 'Component Updated' || h.type === 'Component Republished' || h.type === 'Component Removed')

export const isComponentExamplesSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ComponentExamplesSubscribedContent,
    ComponentExamplesSubscribedHeader
>(isComponentExamplesSubscribedHeader)
