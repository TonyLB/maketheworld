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

/** Header union for events mtw.assets DataSource subscribes to. */
export type AssetsSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset' })

const isWMLZoneChangedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Zone Changed'
const isWMLAssetPurgedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Asset Purged'
const isDiagnosticsHealGlobalValuesHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' } =>
    h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Heal Global Values'
const isCoordinationRemoveAssetHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset' } =>
    h.dataSourceKey === 'mtw.coordination' && h.type === 'Remove Asset'
const isWMLContentUpdateHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Content Update'

export const isAssetsSubscribedHeader: HeaderGuard<AssetsSubscribedHeader> = (header): header is AssetsSubscribedHeader =>
    isWMLZoneChangedHeader(header) ||
    isWMLAssetPurgedHeader(header) ||
    isDiagnosticsHealGlobalValuesHeader(header) ||
    isCoordinationRemoveAssetHeader(header) ||
    isWMLContentUpdateHeader(header)

export const isAssetsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetsSubscribedContent, AssetsSubscribedHeader>(isAssetsSubscribedHeader)

export const isWMLZoneChangedEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLZoneEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }>(isWMLZoneChangedHeader)
export const isWMLAssetPurgedEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLPurgeEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' }>(isWMLAssetPurgedHeader)
export const isDiagnosticsHealGlobalValuesEvent = makeStreamingEnvelopeGuardFromHeaderGuard<{ type: 'Heal Global Values'; connections?: unknown; assets?: unknown }, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' }>(isDiagnosticsHealGlobalValuesHeader)
export const isCoordinationRemoveAssetEvent = makeStreamingEnvelopeGuardFromHeaderGuard<{ type: 'Remove Asset'; assetId: string }, StreamingEventHeader & { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset' }>(isCoordinationRemoveAssetHeader)
export const isWMLContentUpdateEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLContentEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' }>(isWMLContentUpdateHeader)
