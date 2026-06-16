/**
 * Ingress for mtw.ephemera.narration: Character Spoke from mtw.ephemera.actions.
 */
import {
    makeStreamingEnvelopeGuardFromHeaderGuard,
    type HeaderGuard,
    type StreamingEventEnvelope,
    type StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import {
    EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
    type CharacterSpokePublishedPayload,
} from '../actions/publishedEvents'

export { EPHEMERA_ACTIONS_DATA_SOURCE_KEY }

export const CHARACTER_SPOKE_HEADER_TYPE = 'Character Spoke' as const

type CharacterSpokeFromActionsIngressHeader = StreamingEventHeader & {
    dataSourceKey: typeof EPHEMERA_ACTIONS_DATA_SOURCE_KEY
    type: typeof CHARACTER_SPOKE_HEADER_TYPE
}

const isCharacterSpokeFromActionsHeader: HeaderGuard<CharacterSpokeFromActionsIngressHeader> = (
    h
): h is CharacterSpokeFromActionsIngressHeader =>
    h.dataSourceKey === EPHEMERA_ACTIONS_DATA_SOURCE_KEY && h.type === CHARACTER_SPOKE_HEADER_TYPE

export const isCharacterSpokeFromActionsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterSpokePublishedPayload,
    CharacterSpokeFromActionsIngressHeader
>(isCharacterSpokeFromActionsHeader)

export type NarrationSubscribedContent = CharacterSpokePublishedPayload

export const isNarrationSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<NarrationSubscribedContent> => (
    isCharacterSpokeFromActionsEnvelope(envelope)
)
