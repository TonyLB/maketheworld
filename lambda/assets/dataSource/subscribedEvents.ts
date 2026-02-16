/**
 * mtw.assets DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.wml, mtw.diagnostics, mtw.coordination).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLContentEvent, WMLZoneEvent, WMLPurgeEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

/**
 * Envelope-level discriminated union for events subscribed by mtw.assets DataSource.
 * Each variant pairs a narrow header (dataSourceKey + type) with getContentInternal returning the matching content shape,
 * enabling TypeScript to narrow when routing on header.type.
 */
export type AssetsIncomingEvent =
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' };
          getContentInternal: () => Promise<WMLContentEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' };
          getContentInternal: () => Promise<WMLZoneEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' };
          getContentInternal: () => Promise<WMLPurgeEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' };
          getContentInternal: () => Promise<{ type: 'Heal Global Values'; connections?: unknown; assets?: unknown }>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset' };
          getContentInternal: () => Promise<{ type: 'Remove Asset'; assetId: string }>;
      };

/** Payload types of events mtw.assets subscribes to (derived from envelope union for backward compatibility). */
export type AssetsSubscribedContent = WMLContentEvent | WMLZoneEvent | WMLPurgeEvent | { type: 'Heal Global Values'; connections?: unknown; assets?: unknown } | { type: 'Remove Asset'; assetId: string }

const ASSETS_WML_TYPES = new Set(['Content Update', 'Zone Changed', 'Asset Purged'])

export const isAssetsSubscribedHeader: HeaderGuard<StreamingEventHeader> = (header: StreamingEventHeader): header is StreamingEventHeader => {
    if (header.dataSourceKey === 'mtw.wml') return ASSETS_WML_TYPES.has(header.type)
    if (header.dataSourceKey === 'mtw.diagnostics') return header.type === 'Heal Global Values'
    if (header.dataSourceKey === 'mtw.coordination') return header.type === 'Remove Asset'
    return false
}

export const isAssetsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetsSubscribedContent, StreamingEventHeader>(isAssetsSubscribedHeader)

export const isWMLZoneChangedEvent = (event: StreamingEventEnvelope<AssetsSubscribedContent>): event is Extract<
    AssetsIncomingEvent,
    { header: { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } }
> => (
    event.header.dataSourceKey === 'mtw.wml' &&
    event.header.type === 'Zone Changed'
)

export const isWMLAssetPurgedEvent = (event: StreamingEventEnvelope<AssetsSubscribedContent>): event is Extract<
    AssetsIncomingEvent,
    { header: { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' } }
> => (
    event.header.dataSourceKey === 'mtw.wml' &&
    event.header.type === 'Asset Purged'
)

export const isDiagnosticsHealGlobalValuesEvent = (event: StreamingEventEnvelope<AssetsSubscribedContent>): event is Extract<
    AssetsIncomingEvent,
    { header: { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' } }
> => (
    event.header.dataSourceKey === 'mtw.diagnostics' &&
    event.header.type === 'Heal Global Values'
)

export const isCoordinationRemoveAssetEvent = (event: StreamingEventEnvelope<AssetsSubscribedContent>): event is Extract<
    AssetsIncomingEvent,
    { header: { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset' } }
> => (
    event.header.dataSourceKey === 'mtw.coordination' &&
    event.header.type === 'Remove Asset'
)

export const isWMLContentUpdateEvent = (event: StreamingEventEnvelope<AssetsSubscribedContent>): event is Extract<
    AssetsIncomingEvent,
    { header: { dataSourceKey: 'mtw.wml'; type: 'Content Update' } }
> => (
    event.header.dataSourceKey === 'mtw.wml' &&
    event.header.type === 'Content Update'
)
