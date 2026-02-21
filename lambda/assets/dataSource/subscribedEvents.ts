/**
 * mtw.assets DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.wml, mtw.diagnostics).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLContentEvent, WMLZoneEvent, WMLPurgeEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

/**
 * Envelope-level discriminated union for events subscribed by mtw.assets DataSource.
 * Each variant pairs a narrow header (dataSourceKey + type) with getContent returning the matching content shape,
 * enabling TypeScript to narrow when routing on header.type.
 */
export type AssetsIncomingEvent =
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' };
          getContent: () => Promise<WMLContentEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' };
          getContent: () => Promise<WMLZoneEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' };
          getContent: () => Promise<WMLPurgeEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' };
          getContent: () => Promise<{ type: 'Heal Global Values'; connections?: unknown; assets?: unknown }>;
      };

/** Payload types of events mtw.assets subscribes to (derived from envelope union for backward compatibility). */
export type AssetsSubscribedContent = WMLContentEvent | WMLZoneEvent | WMLPurgeEvent | { type: 'Heal Global Values'; connections?: unknown; assets?: unknown }

/** Header union for events mtw.assets DataSource subscribes to. */
export type AssetsSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' })

const isWMLZoneChangedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Zone Changed'
const isWMLAssetPurgedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Asset Purged'
const isDiagnosticsHealGlobalValuesHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' } =>
    h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Heal Global Values'
const isWMLContentUpdateHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Content Update'

export const isAssetsSubscribedHeader: HeaderGuard<AssetsSubscribedHeader> = (header): header is AssetsSubscribedHeader =>
    isWMLZoneChangedHeader(header) ||
    isWMLAssetPurgedHeader(header) ||
    isDiagnosticsHealGlobalValuesHeader(header) ||
    isWMLContentUpdateHeader(header)

export const isAssetsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetsSubscribedContent, AssetsSubscribedHeader>(isAssetsSubscribedHeader)

export const isWMLZoneChangedEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLZoneEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }>(isWMLZoneChangedHeader)
export const isWMLAssetPurgedEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLPurgeEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' }>(isWMLAssetPurgedHeader)
export const isDiagnosticsHealGlobalValuesEvent = makeStreamingEnvelopeGuardFromHeaderGuard<{ type: 'Heal Global Values'; connections?: unknown; assets?: unknown }, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' }>(isDiagnosticsHealGlobalValuesHeader)
export const isWMLContentUpdateEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLContentEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' }>(isWMLContentUpdateHeader)
