import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus, StreamingEventMessage } from '../../messageBus/baseClasses'

/**
 * Outbound stream payloads for mtw.ephemera.positions (bus-only DataSource).
 */
export const EPHEMERA_POSITIONS_DATA_SOURCE_KEY = 'mtw.ephemera.positions' as const

export type CharacterMovedPublishedPayload = {
    type: 'Character Moved';
    characterId: EphemeraCharacterId;
    from: EphemeraRoomId | null;
    to: EphemeraRoomId | null;
    beatAnchorTime: number;
    legalExits?: string[];
    characterName?: string;
}

export type PositionsPublishedPayload = CharacterMovedPublishedPayload

const isMembershipEndpoint = (value: unknown): value is EphemeraRoomId | null => (
    value === null || (typeof value === 'string' && isEphemeraRoomId(value))
)

export const isCharacterMovedPublishedPayload = (
    value: unknown
): value is CharacterMovedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Character Moved') {
        return false
    }
    if (typeof v.characterId !== 'string' || !isEphemeraCharacterId(v.characterId)) {
        return false
    }
    if (!isMembershipEndpoint(v.from) || !isMembershipEndpoint(v.to)) {
        return false
    }
    if (typeof v.beatAnchorTime !== 'number' || !Number.isFinite(v.beatAnchorTime)) {
        return false
    }
    if (v.legalExits !== undefined) {
        if (!Array.isArray(v.legalExits) || !v.legalExits.every((entry) => typeof entry === 'string')) {
            return false
        }
    }
    if (v.characterName !== undefined && typeof v.characterName !== 'string') {
        return false
    }
    return true
}

type PublishBus = Pick<MessageBus, 'publish'>

const positionsPublishSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...(content as Record<string, unknown>),
    }),
}

export async function publishCharacterMovedStreamEvent(
    streamEvent: StreamEventFunction<PositionsPublishedPayload>,
    streamKey: string,
    content: CharacterMovedPublishedPayload,
): Promise<void> {
    await streamEvent({
        update: content,
        streamKey,
        header: { type: 'Character Moved' },
    })
}

/**
 * Test / harness adapter: implements `streamEvent` by delegating to {@link sendCharacterMovedPublish}
 * so assertions can keep using `messageBus.publish` for `StreamingEvent` payloads.
 */
export function streamEventFromMessageBus(bus: PublishBus): StreamEventFunction<PositionsPublishedPayload> {
    return async (params) => {
        sendCharacterMovedPublish(bus, params.streamKey, params.update)
    }
}

export function sendCharacterMovedPublish(
    bus: PublishBus,
    streamKey: string,
    content: CharacterMovedPublishedPayload,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: 'Character Moved',
    }
    const envelope = createInternalOriginEnvelope(header, content, positionsPublishSerializer)
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    }
    bus.publish(message)
}
