/**
 * Ingress for mtw.ephemera.thinking.results: Thinking Result envelopes published on the
 * internal bus by mtw.ephemera.coyoteGame (hypothesis) or mtw.ephemera.actions (Acme enrich).
 */
import type { ThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { THINKING_RESULT_HEADER_TYPE } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import {
    makeStreamingEnvelopeGuardFromHeaderGuard,
    type HeaderGuard,
    type StreamingEventEnvelope,
    type StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import { EPHEMERA_ACTIONS_DATA_SOURCE_KEY } from '../../actions/publishedEvents'

export const EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY = 'mtw.ephemera.coyoteGame' as const

export { EPHEMERA_ACTIONS_DATA_SOURCE_KEY }

type ThinkingResultFromCoyoteIngressHeader = StreamingEventHeader & {
    dataSourceKey: typeof EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY
    type: typeof THINKING_RESULT_HEADER_TYPE
}

type ThinkingResultFromActionsIngressHeader = StreamingEventHeader & {
    dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY
    type: typeof THINKING_RESULT_HEADER_TYPE
}

const isThinkingResultFromCoyoteHeader: HeaderGuard<ThinkingResultFromCoyoteIngressHeader> = (
    h
): h is ThinkingResultFromCoyoteIngressHeader =>
    h.dataSourceKey === EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY && h.type === THINKING_RESULT_HEADER_TYPE

const isThinkingResultFromActionsHeader: HeaderGuard<ThinkingResultFromActionsIngressHeader> = (
    h
): h is ThinkingResultFromActionsIngressHeader =>
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === THINKING_RESULT_HEADER_TYPE

export const isThinkingResultFromCoyoteEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ThinkingResultEvent,
    ThinkingResultFromCoyoteIngressHeader
>(isThinkingResultFromCoyoteHeader)

export const isThinkingResultFromActionsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ThinkingResultEvent,
    ThinkingResultFromActionsIngressHeader
>(isThinkingResultFromActionsHeader)

export const isThinkingResultsSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<ThinkingResultEvent> => (
    isThinkingResultFromCoyoteEnvelope(envelope)
    || isThinkingResultFromActionsEnvelope(envelope)
)
