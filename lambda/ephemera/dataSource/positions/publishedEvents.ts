import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader, HeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { makeStreamingEnvelopeGuardFromHeaderGuard, type StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicNodeTerminal, HostRelationalEdgeKind, RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicNodeTerminal } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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

export type ObjectRelationChangedPublishedPayload = {
    type: 'Object Relation Changed';
    /** Widened from EphemeraObjectId --- the kernel's relational step terminals are no longer Object-only. */
    subjectId: EphemeraLudicNodeTerminal;
    targetId: EphemeraLudicNodeTerminal;
    /** Room or Character host the relation changed on (BD-15/16 slice 4; was Room-only `hostRoomId`). */
    hostId: EphemeraMembershipHostId;
    operation: 'establish' | 'dissolve';
    beatAnchorTime: number;
} & RelationalKindAndLabel

const RELATION_INSTRUCTION_KINDS = new Set<HostRelationalEdgeKind>(['Custom', 'ConnectedTo'])

/**
 * The rooms whose stored `ludicCache` was just marked stale (its marker bumped), whatever the
 * cause: a graph commit, a name change, a heal. A consumer that acts on a cache change subscribes
 * to this rather than inferring one from `Object Moved`.
 */
export type LudicCacheInvalidatedPublishedPayload = {
    type: 'Ludic Cache Invalidated';
    roomIds: EphemeraRoomId[];
}

export type PositionsPublishedPayload =
    | CharacterMovedPublishedPayload
    | ObjectMovedPublishedPayload
    | ObjectRelationChangedPublishedPayload
    | LudicCacheInvalidatedPublishedPayload

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

export const isObjectRelationChangedPublishedPayload = (
    value: unknown
): value is ObjectRelationChangedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Object Relation Changed') {
        return false
    }
    if (!isEphemeraLudicNodeTerminal(v.subjectId)) {
        return false
    }
    if (!isEphemeraLudicNodeTerminal(v.targetId)) {
        return false
    }
    if (typeof v.hostId !== 'string' || !isEphemeraMembershipHostId(v.hostId)) {
        return false
    }
    if (typeof v.relationKind !== 'string' || !RELATION_INSTRUCTION_KINDS.has(v.relationKind as HostRelationalEdgeKind)) {
        return false
    }
    if (v.relationKind === 'Custom') {
        if (typeof v.relationLabel !== 'string' || v.relationLabel.length === 0) {
            return false
        }
    }
    else if (v.relationLabel !== undefined && typeof v.relationLabel !== 'string') {
        return false
    }
    if (v.operation !== 'establish' && v.operation !== 'dissolve') {
        return false
    }
    if (typeof v.beatAnchorTime !== 'number' || !Number.isFinite(v.beatAnchorTime)) {
        return false
    }
    return true
}

export const isLudicCacheInvalidatedPublishedPayload = (
    value: unknown
): value is LudicCacheInvalidatedPublishedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return v.type === 'Ludic Cache Invalidated'
        && Array.isArray(v.roomIds)
        && v.roomIds.length > 0
        && v.roomIds.every((entry) => typeof entry === 'string' && isEphemeraRoomId(entry))
}

export const isPositionsPublishedPayload = (
    value: unknown
): value is PositionsPublishedPayload =>
    isCharacterMovedPublishedPayload(value)
    || isObjectMovedPublishedPayload(value)
    || isObjectRelationChangedPublishedPayload(value)
    || isLudicCacheInvalidatedPublishedPayload(value)

export type EphemeraPositionsCharacterMovedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Character Moved' }

export type EphemeraPositionsObjectMovedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Moved' }

export type EphemeraPositionsObjectRelationChangedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Relation Changed' }

export type EphemeraPositionsLudicCacheInvalidatedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Ludic Cache Invalidated' }

const isEphemeraPositionsCharacterMovedHeader: HeaderGuard<EphemeraPositionsCharacterMovedHeader> = (
    h
): h is EphemeraPositionsCharacterMovedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Character Moved'
)

const isEphemeraPositionsObjectMovedHeader: HeaderGuard<EphemeraPositionsObjectMovedHeader> = (
    h
): h is EphemeraPositionsObjectMovedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Moved'
)

const isEphemeraPositionsObjectRelationChangedHeader: HeaderGuard<EphemeraPositionsObjectRelationChangedHeader> = (
    h
): h is EphemeraPositionsObjectRelationChangedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Object Relation Changed'
)

const isEphemeraPositionsLudicCacheInvalidatedHeader: HeaderGuard<EphemeraPositionsLudicCacheInvalidatedHeader> = (
    h
): h is EphemeraPositionsLudicCacheInvalidatedHeader => (
    h.dataSourceKey === EPHEMERA_POSITIONS_DATA_SOURCE_KEY && h.type === 'Ludic Cache Invalidated'
)

export const isEphemeraPositionsLudicCacheInvalidatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    LudicCacheInvalidatedPublishedPayload,
    EphemeraPositionsLudicCacheInvalidatedHeader
>(isEphemeraPositionsLudicCacheInvalidatedHeader)

export const isEphemeraPositionsCharacterMovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterMovedPublishedPayload,
    EphemeraPositionsCharacterMovedHeader
>(isEphemeraPositionsCharacterMovedHeader)

export const isEphemeraPositionsObjectMovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectMovedPublishedPayload,
    EphemeraPositionsObjectMovedHeader
>(isEphemeraPositionsObjectMovedHeader)

export const isEphemeraPositionsObjectRelationChangedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectRelationChangedPublishedPayload,
    EphemeraPositionsObjectRelationChangedHeader
>(isEphemeraPositionsObjectRelationChangedHeader)

export const isEphemeraPositionsOutboundEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PositionsPublishedPayload> => (
    isEphemeraPositionsObjectMovedEnvelope(envelope)
    || isEphemeraPositionsObjectRelationChangedEnvelope(envelope)
    || isEphemeraPositionsCharacterMovedEnvelope(envelope)
    || isEphemeraPositionsLudicCacheInvalidatedEnvelope(envelope)
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

export async function publishObjectRelationChangedStreamEvent(
    streamEvent: StreamEventFunction<PositionsPublishedPayload>,
    streamKey: string,
    content: ObjectRelationChangedPublishedPayload,
): Promise<void> {
    await streamEvent({
        update: content,
        streamKey,
        header: { type: 'Object Relation Changed' },
    })
}

export async function publishLudicCacheInvalidatedStreamEvent(
    streamEvent: StreamEventFunction<PositionsPublishedPayload>,
    content: LudicCacheInvalidatedPublishedPayload,
): Promise<void> {
    await streamEvent({
        update: content,
        streamKey: content.roomIds[0],
        header: { type: 'Ludic Cache Invalidated' },
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
        if (params.update.type === 'Object Relation Changed') {
            sendObjectRelationChangedPublish(bus, params.streamKey, params.update)
            return
        }
        if (params.update.type === 'Ludic Cache Invalidated') {
            sendLudicCacheInvalidatedPublish(bus, params.streamKey, params.update)
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

export function sendObjectRelationChangedPublish(
    bus: PublishBus,
    streamKey: string,
    content: ObjectRelationChangedPublishedPayload,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: 'Object Relation Changed',
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

export function sendLudicCacheInvalidatedPublish(
    bus: PublishBus,
    streamKey: string,
    content: LudicCacheInvalidatedPublishedPayload,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: EPHEMERA_POSITIONS_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: 'Ludic Cache Invalidated',
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
