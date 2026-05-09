/**
 * mtw.assets.components.verticals DataSource subscription surface: types and envelope guards
 * for mtw.assets Component Updated / Component Republished / Component Removed.
 */
import {
    StreamingEventHeader,
    StreamingEventEnvelope,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    ComponentRepublishedEvent,
    ComponentUpdatedEvent,
    ComponentRemovedEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

export type ComponentVerticalsSubscribedContent =
    | ComponentUpdatedEvent
    | ComponentRepublishedEvent
    | ComponentRemovedEvent

export type ComponentVerticalsSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Republished' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' })

const isComponentVerticalsSubscribedHeader: HeaderGuard<ComponentVerticalsSubscribedHeader> = (
    h
): h is ComponentVerticalsSubscribedHeader =>
    h.dataSourceKey === 'mtw.assets' &&
    (h.type === 'Component Updated' || h.type === 'Component Republished' || h.type === 'Component Removed')

export const isComponentVerticalsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ComponentVerticalsSubscribedContent,
    ComponentVerticalsSubscribedHeader
>(isComponentVerticalsSubscribedHeader)
