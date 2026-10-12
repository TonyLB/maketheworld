/**
 * Ephemera DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Component Updated, Component Removed, Canon Updated, Zone Updated).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    AssetsEventUpdate,
    ComponentUpdatedEvent,
    ComponentRemovedEvent,
    CanonUpdatedEventUpdate,
    ZoneUpdatedEventUpdate,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

export type EphemeraIncomingEvent =
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }; getContent: () => Promise<ComponentUpdatedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' }; getContent: () => Promise<ComponentRemovedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }; getContent: () => Promise<CanonUpdatedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }; getContent: () => Promise<ZoneUpdatedEventUpdate> }

export type EphemeraSubscribedContent = AssetsEventUpdate

/** Header union for events Ephemera DataSource subscribes to. */
export type EphemeraSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' })

const isEphemeraComponentHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Component Updated'
const isEphemeraComponentRemovedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Component Removed'
const isEphemeraCanonUpdatedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Canon Updated'
const isEphemeraZoneUpdatedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Zone Updated'

export const isEphemeraComponentEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ComponentUpdatedEvent, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }>(isEphemeraComponentHeader)
export const isEphemeraComponentRemovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ComponentRemovedEvent, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Removed' }>(isEphemeraComponentRemovedHeader)
export const isEphemeraCanonUpdatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<CanonUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }>(isEphemeraCanonUpdatedHeader)
export const isEphemeraZoneUpdatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ZoneUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }>(isEphemeraZoneUpdatedHeader)

export const isEphemeraSubscribedEventHeader: HeaderGuard<EphemeraSubscribedHeader> = (header): header is EphemeraSubscribedHeader =>
    isEphemeraComponentHeader(header) ||
    isEphemeraComponentRemovedHeader(header) ||
    isEphemeraCanonUpdatedHeader(header) ||
    isEphemeraZoneUpdatedHeader(header)

export const isEphemeraSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<EphemeraSubscribedContent, EphemeraSubscribedHeader>(isEphemeraSubscribedEventHeader)
