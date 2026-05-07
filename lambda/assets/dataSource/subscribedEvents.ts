/**
 * mtw.assets DataSource subscription surface: types and envelope type guards
 * for events this DataSource subscribes to (mtw.wml, mtw.diagnostics).
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLContentEvent, WMLZoneEvent, WMLPurgeEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import type { DiagnosticsCacheConsistencyFindingEvent, DiagnosticsEphemeraRenderCacheFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import type { CognitoNewPlayerEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/cognito'
import { AssetsAPIPayload, AssetsApiSubscribedHeader } from './apiAssets'

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
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Cache Consistency Finding' };
          getContent: () => Promise<DiagnosticsCacheConsistencyFindingEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' };
          getContent: () => Promise<DiagnosticsEphemeraRenderCacheFindingEvent>;
      }
    | {
          header: StreamingEventHeader & { dataSourceKey: 'mtw.cognito'; type: 'New Player' };
          getContent: () => Promise<CognitoNewPlayerEvent>;
      }
    | {
          header: AssetsApiSubscribedHeader;
          getContent: () => Promise<AssetsAPIPayload>;
      };

/** Payload types of events mtw.assets subscribes to (derived from envelope union for backward compatibility). */
export type AssetsSubscribedContent = WMLContentEvent | WMLZoneEvent | WMLPurgeEvent | { type: 'Heal Global Values'; connections?: unknown; assets?: unknown } | DiagnosticsCacheConsistencyFindingEvent | DiagnosticsEphemeraRenderCacheFindingEvent | CognitoNewPlayerEvent | AssetsAPIPayload

/** Header union for events mtw.assets DataSource subscribes to. */
export type AssetsSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Cache Consistency Finding' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.cognito'; type: 'New Player' })
    | AssetsApiSubscribedHeader

const isWMLZoneChangedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Zone Changed'
const isWMLAssetPurgedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Asset Purged'
const isDiagnosticsHealGlobalValuesHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' } =>
    h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Heal Global Values'
const isDiagnosticsCacheConsistencyFindingHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Cache Consistency Finding' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Cache Consistency Finding' } =>
    h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Cache Consistency Finding'
const isDiagnosticsEphemeraRenderCacheFindingHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' } =>
    h.dataSourceKey === 'mtw.diagnostics' && h.type === 'Ephemera RenderCache Finding'
const isCognitoNewPlayerHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.cognito'; type: 'New Player' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.cognito'; type: 'New Player' } =>
    h.dataSourceKey === 'mtw.cognito' && h.type === 'New Player'
const isApiAssetsHealPlayerHeader: HeaderGuard<AssetsApiSubscribedHeader> = (h): h is AssetsApiSubscribedHeader =>
    h.dataSourceKey === 'api.assets' && h.type === 'HealPlayer'
const isWMLContentUpdateHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' } =>
    h.dataSourceKey === 'mtw.wml' && h.type === 'Content Update'

export const isAssetsSubscribedHeader: HeaderGuard<AssetsSubscribedHeader> = (header): header is AssetsSubscribedHeader =>
    isWMLZoneChangedHeader(header) ||
    isWMLAssetPurgedHeader(header) ||
    isDiagnosticsHealGlobalValuesHeader(header) ||
    isDiagnosticsCacheConsistencyFindingHeader(header) ||
    isDiagnosticsEphemeraRenderCacheFindingHeader(header) ||
    isCognitoNewPlayerHeader(header) ||
    isApiAssetsHealPlayerHeader(header) ||
    isWMLContentUpdateHeader(header)

export const isAssetsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetsSubscribedContent, AssetsSubscribedHeader>(isAssetsSubscribedHeader)

export const isWMLZoneChangedEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLZoneEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' }>(isWMLZoneChangedHeader)
export const isWMLAssetPurgedEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLPurgeEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' }>(isWMLAssetPurgedHeader)
export const isDiagnosticsHealGlobalValuesEvent = makeStreamingEnvelopeGuardFromHeaderGuard<{ type: 'Heal Global Values'; connections?: unknown; assets?: unknown }, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' }>(isDiagnosticsHealGlobalValuesHeader)
export const isDiagnosticsCacheConsistencyFindingEvent = makeStreamingEnvelopeGuardFromHeaderGuard<DiagnosticsCacheConsistencyFindingEvent, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Cache Consistency Finding' }>(isDiagnosticsCacheConsistencyFindingHeader)
export const isDiagnosticsEphemeraRenderCacheFindingEvent = makeStreamingEnvelopeGuardFromHeaderGuard<DiagnosticsEphemeraRenderCacheFindingEvent, StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ephemera RenderCache Finding' }>(isDiagnosticsEphemeraRenderCacheFindingHeader)
export const isCognitoNewPlayerEvent = makeStreamingEnvelopeGuardFromHeaderGuard<CognitoNewPlayerEvent, StreamingEventHeader & { dataSourceKey: 'mtw.cognito'; type: 'New Player' }>(isCognitoNewPlayerHeader)
export const isApiAssetsHealPlayerEvent = makeStreamingEnvelopeGuardFromHeaderGuard<AssetsAPIPayload, AssetsApiSubscribedHeader>(isApiAssetsHealPlayerHeader)
export const isWMLContentUpdateEvent = makeStreamingEnvelopeGuardFromHeaderGuard<WMLContentEvent, StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Content Update' }>(isWMLContentUpdateHeader)
