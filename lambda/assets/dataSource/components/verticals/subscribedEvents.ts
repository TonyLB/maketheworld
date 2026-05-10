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
import type { DiagnosticsComponentVerticalMisalignedFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

export type ComponentVerticalsSubscribedContent =
    | ComponentUpdatedEvent
    | ComponentRepublishedEvent
    | ComponentRemovedEvent
    | DiagnosticsComponentVerticalMisalignedFindingEvent

export type ComponentVerticalsSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Republished' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Component Vertical Misaligned Finding' })

const isComponentVerticalsSubscribedHeader: HeaderGuard<ComponentVerticalsSubscribedHeader> = (
    h
): h is ComponentVerticalsSubscribedHeader =>
    (h.dataSourceKey === 'mtw.assets' &&
        (h.type === 'Component Updated' || h.type === 'Component Republished' || h.type === 'Component Removed')) ||
    (h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Component Vertical Misaligned Finding')

export const isComponentVerticalsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ComponentVerticalsSubscribedContent,
    ComponentVerticalsSubscribedHeader
>(isComponentVerticalsSubscribedHeader)
