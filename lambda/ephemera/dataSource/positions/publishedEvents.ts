import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader, HeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { makeStreamingEnvelopeGuardFromHeaderGuard, type StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
    /** Set when the caller's own compiled step sequence already narrated this move synchronously (every membership route as of Phase 3). Historically signaled the now-retired async membership-presentation fan-in to drop its fact leg; kept on the fact payload as a record of narration provenance. */
    narratedInline?: boolean;
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
    /** LP4g: widened from EphemeraObjectId --- the kernel's relational step terminals are no longer Object-only. */
    subjectId: EphemeraLudicTerminalPrimitive;
    targetId: EphemeraLudicTerminalPrimitive;
    /** Room or Character host the relation changed on (BD-15/16 slice 4; was Room-only `hostRoomId`). */
    hostId: EphemeraMembershipHostId;
    relationKind: HostRelationalEdgeKind;
    relationLabel?: string;
    operation: 'establish' | 'dissolve';
    beatAnchorTime: number;
}

const HOST_RELATIONAL_EDGE_KINDS = new Set<HostRelationalEdgeKind>(['On', 'Under', 'Against', 'Custom', 'In', 'PartOf', 'Present'])

export type PositionsPublishedPayload =
    | CharacterMovedPublishedPayload
    | ObjectMovedPublishedPayload
    | ObjectRelationChangedPublishedPayload

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
    if (v.narratedInline !== undefined && typeof v.narratedInline !== 'boolean') {
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
    if (typeof v.subjectId !== 'string' || !isEphemeraLudicTerminalPrimitive(v.subjectId)) {
        return false
    }
    if (typeof v.targetId !== 'string' || !isEphemeraLudicTerminalPrimitive(v.targetId)) {
        return false
    }
    if (typeof v.hostId !== 'string' || !isEphemeraMembershipHostId(v.hostId)) {
        return false
    }
    if (typeof v.relationKind !== 'string' || !HOST_RELATIONAL_EDGE_KINDS.has(v.relationKind as HostRelationalEdgeKind)) {
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

export const isPositionsPublishedPayload = (
    value: unknown
): value is PositionsPublishedPayload =>
    isCharacterMovedPublishedPayload(value)
    || isObjectMovedPublishedPayload(value)
    || isObjectRelationChangedPublishedPayload(value)

export type EphemeraPositionsObjectMovedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Moved' }

export type EphemeraPositionsObjectRelationChangedHeader =
    StreamingEventHeader & { dataSourceKey: typeof EPHEMERA_POSITIONS_DATA_SOURCE_KEY; type: 'Object Relation Changed' }

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
