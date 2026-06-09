/**
 * Room description and room header broadcast fan-in: correlate renderOrchestration / renderCache streams
 * to Perception Thread Registered rows.
 */
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import {
    isCharacterMovePerceptionThread,
    isRoomDescriptionPerceptionThread,
    isRoomHeaderBroadcastPerceptionThread,
    isSessionOrientationRenderPerceptionThread,
} from '../../internalCache/perceptionThreads'
import type { PublishTarget } from '../../messageBus/baseClasses'
import type { PerceptionThreadRegisterCharacterMoveCommand } from './localApiEvents'
import { roomHeaderErrorPlaceholderWml, roomHeaderGeneratingPlaceholderWml } from './roomHeaderPlaceholderWml'
import { roomHeaderWmlFromCacheRecord, roomRenderWmlFromCacheRecord } from './roomRenderWmlFromCacheRecord'
import { isRenderCacheRenderPertainsPayload } from '../renderCache/baseClasses'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'
import {
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationGenerationStartedPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
} from '../renderOrchestration/publishedEvents'
import { getCharacterRoomPerspectiveKey } from './kickRoomHeaderBroadcast'

/**
 * TEMPORARY: Word joiner (U+2060) as non-whitespace display title so WML round-trips.
 * `packages/mtw-wml/ts/schema/converters/components.ts` `Render.finalize` currently requires
 * exactly three ordered children (DisplayName, Summary, Description) and rejects an empty
 * DisplayName after trim. Remove this constant once `Render.finalize` (and matching emit/standardize
 * behavior) are loosened so partial or empty DisplayName/Summary can round-trip; then use a normal
 * empty or omitted display name in `placeholderRoomFullWml` instead.
 */
const PLACEHOLDER_RENDER_INVISIBLE_TITLE = '\u2060'

function placeholderRoomFullWml(roomId: EphemeraRoomId, bodyText: string): string {
    const renderPayload = situationRoomRenderPayloadFromCacheRenderedContent({
        displayName: [PLACEHOLDER_RENDER_INVISIBLE_TITLE],
        summary: [''],
        description: [bodyText],
    })
    const roomRow: StandardRoomData = {
        tag: 'Room',
        universalKey: roomId,
        ...(renderPayload ? { render: renderPayload } : {}),
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        roomRow,
    ], { standardizeMode: 'ephemeraWire' })
    return schemaToWML([form.schema])
}

function logTerminalDedupe(
    eventLabel: string,
    componentId: string,
    perspectiveKey: string,
    registrationId: string
): void {
    console.log(
        `[mtw.ephemera.perception] skip ${eventLabel} (terminal) ${componentId} ${perspectiveKey} registrationId=${registrationId}`
    )
}

async function resolveFallbackRenderTargetsForPerspective(
    roomId: EphemeraRoomId,
    perspectiveKey: string
): Promise<EphemeraCharacterId[]> {
    const occupants = await internalCache.RoomCharacterList.get(roomId)
    if (!occupants.length) {
        return []
    }
    const matches = await Promise.all(
        occupants.map(async ({ EphemeraId }) => {
            const characterId = EphemeraId as EphemeraCharacterId
            const characterMeta = await internalCache.CharacterMeta.get(characterId)
            const characterPerspectiveKey = await getCharacterRoomPerspectiveKey(roomId, characterMeta?.assets || [])
            if (characterPerspectiveKey === perspectiveKey) {
                return characterId
            }
            return null
        })
    )
    return matches.filter((target): target is EphemeraCharacterId => Boolean(target))
}

function headerTargetsForCharacterMove(
    registration: PerceptionThreadRegisterCharacterMoveCommand
): PublishTarget[] {
    return registration.headerTargets?.length ? registration.headerTargets : [registration.characterId]
}

function publishCharacterMoveLeaveIfNeeded(
    bus: MessageBus,
    entry: ReturnType<typeof internalCache.PerceptionThreads.list>[number],
    componentId: EphemeraRoomId,
    perspectiveKey: string
): void {
    const { registration, registrationId, thread } = entry
    if (registration.threadKind !== 'characterMove' || !isCharacterMovePerceptionThread(thread)) {
        return
    }
    if (thread.leaveDispatched) {
        return
    }
    const leave = registration.leaveWorldMessage
    if (leave) {
        bus.send({
            type: 'PublishMessage',
            displayProtocol: 'WorldMessage',
            targets: leave.targets,
            message: leave.message,
            messageGroupId: registration.leaveMessageGroupId,
        })
    }
    internalCache.PerceptionThreads.update(
        { componentId, perspectiveKey, registrationId },
        { threadKind: 'characterMove', leaveDispatched: true }
    )
}

function publishCharacterMoveArriveIfNeeded(
    bus: MessageBus,
    entry: ReturnType<typeof internalCache.PerceptionThreads.list>[number],
    componentId: EphemeraRoomId,
    perspectiveKey: string
): void {
    const { registration, registrationId, thread } = entry
    if (registration.threadKind !== 'characterMove' || !isCharacterMovePerceptionThread(thread)) {
        return
    }
    if (thread.arriveDispatched) {
        return
    }
    const arrive = registration.arriveWorldMessage
    if (arrive) {
        bus.send({
            type: 'PublishMessage',
            displayProtocol: 'WorldMessage',
            targets: arrive.targets,
            message: arrive.message,
            messageGroupId: registration.arriveMessageGroupId,
        })
    }
    internalCache.PerceptionThreads.update(
        { componentId, perspectiveKey, registrationId },
        { threadKind: 'characterMove', arriveDispatched: true }
    )
}

export async function orchestrateRoomDescriptionStreams(
    raw: unknown,
    bus: MessageBus
): Promise<void> {
    if (isRenderCacheRenderPertainsPayload(raw)) {
        await handleRenderPertains(raw, bus)
        return
    }
    if (isRenderOrchestrationGenerationStartedPayload(raw)) {
        await handleGenerationStarted(raw, bus)
        return
    }
    if (isRenderOrchestrationOrchestrationErrorPayload(raw) || isRenderOrchestrationGenerationDeferredPayload(raw)) {
        await handleOrchestrationErrorOrDeferred(raw, bus)
    }
}

async function handleRenderPertains(
    payload: import('../renderCache/baseClasses').RenderCacheRenderPertainsPayload,
    bus: MessageBus
): Promise<void> {
    if (!isEphemeraRoomId(payload.componentId)) {
        return
    }
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    const terminalRenderWml = roomRenderWmlFromCacheRecord(
        payload.componentId,
        payload.cacheRecord.renderedContent
    )
    const terminalHeaderWml = roomHeaderWmlFromCacheRecord(
        payload.componentId,
        payload.cacheRecord.renderedContent
    )

    let publishedRoomDescription = 0
    let skippedRoomDescriptionTerminal = 0
    let publishedHeaderBroadcast = 0
    let skippedHeaderTerminal = 0
    let skippedHeaderEmptyTargets = 0
    let publishedSessionOrientationRender = 0
    let skippedSessionOrientationRenderTerminal = 0
    let skippedSessionOrientationRenderEmptyTargets = 0
    let publishedCharacterMove = 0
    let skippedCharacterMoveTerminal = 0
    let skippedCharacterMoveEmptyTargets = 0

    for (const entry of entries) {
        if (!isRoomDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'roomDescription') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Render Pertains', payload.componentId, payload.perspectiveKey, registrationId)
            skippedRoomDescriptionTerminal += 1
            continue
        }
        const characterId = registration.characterId

        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: terminalRenderWml,
            metaData: {
                componentUUID: payload.componentId,
                displayMode: 'full',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })
        publishedRoomDescription += 1

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isRoomHeaderBroadcastPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'roomHeaderBroadcast') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Render Pertains', payload.componentId, payload.perspectiveKey, registrationId)
            skippedHeaderTerminal += 1
            continue
        }
        const targets = registration.targets
        const roomId = payload.componentId
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        if (targets.length) {
            bus.send({
                type: 'PublishMessage',
                targets,
                displayProtocol: 'PerceptionMessage',
                wmlContent: terminalHeaderWml,
                metaData: {
                    componentUUID: roomId,
                    displayMode: 'header',
                    roomChannel: 'render',
                },
                messageGroupId: registration.messageGroupId,
                messageId,
            })
            publishedHeaderBroadcast += 1
        }
        else {
            skippedHeaderEmptyTargets += 1
        }

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isSessionOrientationRenderPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'sessionOrientationRender') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Render Pertains', payload.componentId, payload.perspectiveKey, registrationId)
            skippedSessionOrientationRenderTerminal += 1
            continue
        }
        const targets = registration.targets
        const roomId = payload.componentId
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        if (targets.length) {
            bus.send({
                type: 'PublishMessage',
                targets,
                displayProtocol: 'PerceptionMessage',
                wmlContent: terminalHeaderWml,
                metaData: {
                    componentUUID: roomId,
                    displayMode: 'header',
                    roomChannel: 'render',
                },
                messageGroupId: registration.messageGroupId,
                messageId,
            })
            publishedSessionOrientationRender += 1
        }
        else {
            skippedSessionOrientationRenderEmptyTargets += 1
        }

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isCharacterMovePerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'characterMove') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Render Pertains', payload.componentId, payload.perspectiveKey, registrationId)
            skippedCharacterMoveTerminal += 1
            continue
        }
        publishCharacterMoveLeaveIfNeeded(bus, entry, payload.componentId, payload.perspectiveKey)
        const targets = headerTargetsForCharacterMove(registration)
        const roomId = payload.componentId
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        if (targets.length) {
            bus.send({
                type: 'PublishMessage',
                targets,
                displayProtocol: 'PerceptionMessage',
                wmlContent: terminalHeaderWml,
                metaData: {
                    componentUUID: roomId,
                    displayMode: 'header',
                    roomChannel: 'render',
                },
                messageGroupId: registration.messageGroupId,
                messageId,
            })
            publishedCharacterMove += 1
        }
        else {
            skippedCharacterMoveEmptyTargets += 1
        }
        publishCharacterMoveArriveIfNeeded(bus, entry, payload.componentId, payload.perspectiveKey)

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    let fallbackPublished = 0
    let fallbackTargetsMatched = 0
    if (entries.length === 0) {
        const fallbackTargets = await resolveFallbackRenderTargetsForPerspective(
            payload.componentId,
            payload.perspectiveKey
        )
        fallbackTargetsMatched = fallbackTargets.length
        if (fallbackTargets.length) {
            bus.send({
                type: 'PublishMessage',
                targets: fallbackTargets,
                displayProtocol: 'PerceptionMessage',
                wmlContent: terminalHeaderWml,
                metaData: {
                    componentUUID: payload.componentId,
                    displayMode: 'header',
                    roomChannel: 'render',
                },
                messageId: `MESSAGE#${uuidv4()}`,
            })
            fallbackPublished = 1
        }
    }

    const summary = {
        componentId: payload.componentId,
        perspectiveKey: payload.perspectiveKey,
        cacheId: payload.cacheId,
        bucketSize: entries.length,
        publishedRoomDescription,
        skippedRoomDescriptionTerminal,
        publishedHeaderBroadcast,
        skippedHeaderTerminal,
        skippedHeaderEmptyTargets,
        publishedSessionOrientationRender,
        skippedSessionOrientationRenderTerminal,
        skippedSessionOrientationRenderEmptyTargets,
        publishedCharacterMove,
        skippedCharacterMoveTerminal,
        skippedCharacterMoveEmptyTargets,
        fallbackTargetsMatched,
        fallbackPublished,
    }
    if (entries.length === 0) {
        console.warn('[mtw.ephemera.perception] handleRenderPertains: no PerceptionThreads rows for bucket; fallback attempted', summary)
    }
    else {
        console.log('[mtw.ephemera.perception] handleRenderPertains', summary)
    }
}

async function handleGenerationStarted(
    payload: import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationStartedPayload,
    bus: MessageBus
): Promise<void> {
    if (!isEphemeraRoomId(payload.componentId)) {
        return
    }
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    for (const entry of entries) {
        if (!isRoomDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'roomDescription') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Generation Started', payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const characterId = registration.characterId

        const messageId = `MESSAGE#${uuidv4()}`
        const roomId = payload.componentId
        bus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderRoomFullWml(roomId, 'Generating'),
            metaData: {
                componentUUID: roomId,
                displayMode: 'full',
                status: 'generating',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'roomDescription', status: 'Generating', messageId }
        )
    }

    for (const entry of entries) {
        if (!isRoomHeaderBroadcastPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'roomHeaderBroadcast') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Generation Started', payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const roomId = payload.componentId
        const messageId = `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets: registration.targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: roomHeaderGeneratingPlaceholderWml(roomId),
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                status: 'generating',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'roomHeaderBroadcast', status: 'Generating', messageId }
        )
    }

    for (const entry of entries) {
        if (!isSessionOrientationRenderPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'sessionOrientationRender') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Generation Started', payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const roomId = payload.componentId
        const messageId = `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets: registration.targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: roomHeaderGeneratingPlaceholderWml(roomId),
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                status: 'generating',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'sessionOrientationRender', status: 'Generating', messageId }
        )
    }

    for (const entry of entries) {
        if (!isCharacterMovePerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'characterMove') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Generation Started', payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        publishCharacterMoveLeaveIfNeeded(bus, entry, payload.componentId, payload.perspectiveKey)
        const roomId = payload.componentId
        const targets = headerTargetsForCharacterMove(registration)
        const messageId = `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: roomHeaderGeneratingPlaceholderWml(roomId),
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                status: 'generating',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'characterMove', status: 'Generating', messageId }
        )
        publishCharacterMoveArriveIfNeeded(bus, entry, payload.componentId, payload.perspectiveKey)
    }
}

type ErrorLikePayload =
    | import('../renderOrchestration/publishedEvents').RenderOrchestrationOrchestrationErrorPayload
    | import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationDeferredPayload

async function handleOrchestrationErrorOrDeferred(payload: ErrorLikePayload, bus: MessageBus): Promise<void> {
    if (!isEphemeraRoomId(payload.componentId)) {
        return
    }
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    for (const entry of entries) {
        if (!isRoomDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'roomDescription') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe(payload.type, payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const characterId = registration.characterId

        const roomId = payload.componentId
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderRoomFullWml(roomId, 'Error'),
            metaData: {
                componentUUID: roomId,
                displayMode: 'full',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isRoomHeaderBroadcastPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'roomHeaderBroadcast') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe(payload.type, payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }

        const roomId = payload.componentId
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets: registration.targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: roomHeaderErrorPlaceholderWml(roomId),
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isSessionOrientationRenderPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'sessionOrientationRender') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe(payload.type, payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }

        const roomId = payload.componentId
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets: registration.targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: roomHeaderErrorPlaceholderWml(roomId),
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isCharacterMovePerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'characterMove') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe(payload.type, payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        publishCharacterMoveLeaveIfNeeded(bus, entry, payload.componentId, payload.perspectiveKey)

        const roomId = payload.componentId
        const targets = headerTargetsForCharacterMove(registration)
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.send({
            type: 'PublishMessage',
            targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: roomHeaderErrorPlaceholderWml(roomId),
            metaData: {
                componentUUID: roomId,
                displayMode: 'header',
                roomChannel: 'render',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })
        publishCharacterMoveArriveIfNeeded(bus, entry, payload.componentId, payload.perspectiveKey)

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }
}
