/**
 * Ingress envelope guards for mtw.ephemera.perception.
 * Placeholder header matches no production senders yet; step 2 adds real api.ephemera ingress.
 */
import {
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

/** Matches `dataSourceKey` for this DataSource (see index.ts). */
export const PERCEPTION_DATA_SOURCE_KEY = 'mtw.ephemera.perception' as const

/** Placeholder `getContent()` shape until real ingress is wired. */
export type PerceptionIngressPlaceholderPayload = {
    type: 'PerceptionIngressPlaceholder';
}

export type PerceptionSubscribedHeader = StreamingEventHeader & {
    dataSourceKey: typeof PERCEPTION_DATA_SOURCE_KEY;
    type: 'PerceptionIngressPlaceholder';
}

const isPerceptionPlaceholderHeader: HeaderGuard<PerceptionSubscribedHeader> = (
    h
): h is PerceptionSubscribedHeader => (
    h.dataSourceKey === PERCEPTION_DATA_SOURCE_KEY && h.type === 'PerceptionIngressPlaceholder'
)

export const isPerceptionSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PerceptionIngressPlaceholderPayload,
    PerceptionSubscribedHeader
>(isPerceptionPlaceholderHeader)
