/**
 * Ephemera DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Component Updated, Canon Updated, Zone Updated).
 */
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    AssetsEventUpdate,
    ComponentUpdatedEvent,
    CanonUpdatedEventUpdate,
    ZoneUpdatedEventUpdate,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'

export const EPHEMERA_ASSET_EVENT_TYPES = new Set(['Component Updated', 'Canon Updated', 'Zone Updated'])

export type EphemeraIncomingEvent =
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }; getContentInternal: () => Promise<ComponentUpdatedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }; getContentInternal: () => Promise<CanonUpdatedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }; getContentInternal: () => Promise<ZoneUpdatedEventUpdate> }

export const isEphemeraComponentEnvelope = (evt: StreamingEventEnvelope<AssetsEventUpdate>): evt is Extract<EphemeraIncomingEvent, { header: { type: 'Component Updated' } }> =>
    evt.header.dataSourceKey === 'mtw.assets' && evt.header.type === 'Component Updated'
export const isEphemeraCanonUpdatedEnvelope = (evt: StreamingEventEnvelope<AssetsEventUpdate>): evt is Extract<EphemeraIncomingEvent, { header: { type: 'Canon Updated' } }> =>
    evt.header.dataSourceKey === 'mtw.assets' && evt.header.type === 'Canon Updated'
export const isEphemeraZoneUpdatedEnvelope = (evt: StreamingEventEnvelope<AssetsEventUpdate>): evt is Extract<EphemeraIncomingEvent, { header: { type: 'Zone Updated' } }> =>
    evt.header.dataSourceKey === 'mtw.assets' && evt.header.type === 'Zone Updated'
