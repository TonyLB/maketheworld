/**
 * Ingress for mtw.ephemera.thinking.results: Thinking Result envelopes published on the
 * internal bus by mtw.ephemera.coyoteGame (publisher `header.dataSourceKey`).
 */
import type { ThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { THINKING_RESULT_HEADER_TYPE } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import {
    makeStreamingEnvelopeGuardFromHeaderGuard,
    type HeaderGuard,
    type StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

export const EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY = 'mtw.ephemera.coyoteGame' as const

type ThinkingResultIngressHeader = StreamingEventHeader & {
    dataSourceKey: typeof EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY
    type: typeof THINKING_RESULT_HEADER_TYPE
}

const isThinkingResultFromCoyoteHeader: HeaderGuard<ThinkingResultIngressHeader> = (
    h
): h is ThinkingResultIngressHeader =>
    h.dataSourceKey === EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY && h.type === THINKING_RESULT_HEADER_TYPE

export const isThinkingResultsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ThinkingResultEvent,
    ThinkingResultIngressHeader
>(isThinkingResultFromCoyoteHeader)
