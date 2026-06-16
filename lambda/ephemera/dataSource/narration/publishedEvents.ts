/**
 * Outbound stream payloads for mtw.ephemera.narration (subscribe-only; no meaningful publishes yet).
 */
export const EPHEMERA_NARRATION_DATA_SOURCE_KEY = 'mtw.ephemera.narration' as const

export type NarrationNoopPublishedPayload = {
    type: 'Narration noop';
}

export type NarrationPublishedPayload = NarrationNoopPublishedPayload
