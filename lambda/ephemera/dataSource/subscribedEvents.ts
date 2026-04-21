/**
 * Ephemera DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.assets: Component Updated, Canon Updated, Zone Updated).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    AssetsEventUpdate,
    ComponentUpdatedEvent,
    CanonUpdatedEventUpdate,
    ZoneUpdatedEventUpdate,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import { DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

export type EphemeraIncomingEvent =
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }; getContent: () => Promise<ComponentUpdatedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }; getContent: () => Promise<CanonUpdatedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }; getContent: () => Promise<ZoneUpdatedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' }; getContent: () => Promise<DiagnosticsEphemeraRenderCacheFindingEvent> }

/** Header union for events Ephemera DataSource subscribes to. */
export type EphemeraSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' })

const isEphemeraComponentHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Component Updated'
const isEphemeraCanonUpdatedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Canon Updated'
const isEphemeraZoneUpdatedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Zone Updated'
const isEphemeraRenderCacheFindingHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' } =>
    h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Ephemera RenderCache Finding'

export const isEphemeraComponentEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ComponentUpdatedEvent, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Component Updated' }>(isEphemeraComponentHeader)
export const isEphemeraCanonUpdatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<CanonUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Canon Updated' }>(isEphemeraCanonUpdatedHeader)
export const isEphemeraZoneUpdatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ZoneUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }>(isEphemeraZoneUpdatedHeader)
export const isEphemeraRenderCacheFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<DiagnosticsEphemeraRenderCacheFindingEvent, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' }>(isEphemeraRenderCacheFindingHeader)

export const isEphemeraSubscribedEventHeader: HeaderGuard<EphemeraSubscribedHeader> = (header): header is EphemeraSubscribedHeader =>
    isEphemeraComponentHeader(header) ||
    isEphemeraCanonUpdatedHeader(header) ||
    isEphemeraZoneUpdatedHeader(header) ||
    isEphemeraRenderCacheFindingHeader(header)

export const isEphemeraSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetsEventUpdate | DiagnosticsEphemeraRenderCacheFindingEvent, EphemeraSubscribedHeader>(isEphemeraSubscribedEventHeader)
