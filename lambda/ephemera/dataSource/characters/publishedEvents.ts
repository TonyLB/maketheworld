/**
 * Outbound stream payloads for mtw.ephemera.characters (subscribe-only; no meaningful publishes yet).
 */
export const EPHEMERA_CHARACTERS_DATA_SOURCE_KEY = 'mtw.ephemera.characters' as const

export type CharactersNoopPublishedPayload = {
    type: 'Characters noop';
}

export type CharactersPublishedPayload = CharactersNoopPublishedPayload
