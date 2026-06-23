import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader, HeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { makeStreamingEnvelopeGuardFromHeaderGuard, type StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { MessageBus, StreamingEventMessage } from '../../messageBus/baseClasses'

/**
 * Outbound stream payloads for mtw.ephemera.positions (bus-only DataSource).
 */
export const EPHEMERA_POSITIONS_DATA_SOURCE_KEY = 'mtw.ephemera.positions' as const

export type CharacterMovedPublishedPayload = {
    type: 'Character Moved';
    characterId: EphemeraCharacterId;
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    beatAnchorTime: number;
    legalExits?: string[];
    characterName?: string;
}

export type ObjectMovedPublishedPayload = {
    type: 'Object Moved';
    objectId: EphemeraObjectId;
    froms: EphemeraMembershipHostId[];
    to: EphemeraMembershipHostId | null;
    beatAnchorTime: number;
}

export type PositionsPublishedPayload = CharacterMovedPublishedPayload | ObjectMovedPublishedPayload

const isRoomMembershipEndpoint = (value: unknown): value is EphemeraRoomId | null => (
    value === null || (typeof value === 'string' && isEphemeraRoomId(value))
)

const isObjectMembershipEndpoint = (value: unknown): value is EphemeraMembershipHostId | null => (
    value === null || (typeof value === 'string' && isEphemeraMembershipHostId(value))
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
    if ('from' in v) {
        return false
    }
    if (!Array.isArray(v.froms) || !v.froms.every((entry) => typeof entry === 'string' && isEphemeraRoomId(entry))) {
        return false
    }
    if (!isRoomMembershipEndpoint(v.to)) {
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

export const isObjectMovedPublishedPayload = (
    value: unknown
): value is ObjectMovedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Moved') {
        return false
    }
    if (typeof v.objectId !== 'string' || !isEphemeraObjectId(v.objectId)) {
        return false
    }
    if ('from' in v) {
        return false
    }
    if (!Array.isArray(v.froms) || !v.froms.every((entry) => typeof entry === 'string' && isEphemeraMembershipHostId(entry))) {
        return false
    }
    if (!isObjectMembershipEndpoint(v.to)) {
        return false
    }
    if (typeof v.beatAnchorTime !== 'number' || !Number.isFinite(v.beatAnchorTime)) {
        return false
    }
    return true
}

export const isPositionsPublishedPayload = (
    value: unknown
): value is PositionsPublishedPayload =>
    isCharacterMovedPublishedPayload(value) || isObjectMovedPublishedPayload(value)

export type EphemeraPositionsObjectMovedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Moved' }

const isEphemeraPositionsObjectMovedHeader: HeaderGuard<EphemeraPositionsObjectMovedHeader> = (
    h
): h is EphemeraPositionsObjectMovedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Moved'
)

export const isEphemeraPositionsObjectMovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectMovedPublishedPayload,
    EphemeraPositionsObjectMovedHeader
>(isEphemeraPositionsObjectMovedHeader)

export const isEphemeraPositionsOutboundEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PositionsPublishedPayload> => (
    isEphemeraPositionsObjectMovedEnvelope(envelope)
    || (envelope.header.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY
        && envelope.header.type === 'Character Moved')
)

type PublishBus = Pick<MessageBus, 'publish'>

const positionsPublishSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...(content as Record<string, unknown>),
    }),
}

export async function publishObjectMovedStreamEvent(
    streamEvent: StreamEventFunction<PositionsPublishedPayload>,
    streamKey: string,
    content: ObjectMovedPublishedPayload,
): Promise<void> {
    await streamEvent({
        update: content,
        streamKey,
        header: { type: 'Object Moved' },
    })
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
        if (params.update.type === 'Object Moved') {
            sendObjectMovedPublish(bus, params.streamKey, params.update)
            return
        }
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

export function sendObjectMovedPublish(
    bus: PublishBus,
    streamKey: string,
    content: ObjectMovedPublishedPayload,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: 'Object Moved',
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
