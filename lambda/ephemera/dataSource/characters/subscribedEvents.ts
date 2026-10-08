/**
 * Ingress for mtw.ephemera.characters: Character Moved from mtw.ephemera.positions.
 */
import type { StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import {
    EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
    isEphemeraPositionsCharacterMovedEnvelope,
    type CharacterMovedPublishedPayload,
} from '../positions/publishedEvents'

export { EPHEMERA_POSITIONS_DATA_SOURCE_KEY }

export const CHARACTER_MOVED_HEADER_TYPE = 'Character Moved' as const

export type CharactersSubscribedContent = CharacterMovedPublishedPayload

export const isCharactersSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<CharactersSubscribedContent> => (
    isEphemeraPositionsCharacterMovedEnvelope(envelope)
)
