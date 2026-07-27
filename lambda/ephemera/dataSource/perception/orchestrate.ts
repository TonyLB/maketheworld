/**
 * Room description, room header broadcast, and Feature/Knowledge description fan-in: correlate
 * renderOrchestration / renderCache streams to Perception Thread Registered rows.
 */
import { v4 as uuidv4 } from 'uuid'
import type {
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraObjectId,
    EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import { getRoomCharacterList } from '../../internalCache/hydrateRoomRoster'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import {
    isFeatureDescriptionPerceptionThread,
    isKnowledgeDescriptionPerceptionThread,
    isObjectDescriptionPerceptionThread,
    isRoomDescriptionPerceptionThread,
    isRoomHeaderBroadcastPerceptionThread,
    isSessionOrientationRenderPerceptionThread,
} from '../../internalCache/perceptionThreads'
import type { PerceptionThreadRegisterKnowledgeDescriptionCommand } from './localApiEvents'
import type { PublishTarget } from '../../messageBus/baseClasses'
import { reportIngressContent } from '../messageOrchestration'
import type { RenderContent } from '../messageOrchestration/contentIngress'
import {
    featureRenderWmlFromCacheRecord,
    knowledgeRenderWmlFromCacheRecord,
} from './featureKnowledgeRenderWmlFromCacheRecord'
import { objectRenderWmlFromCacheRecord } from './objectRenderWmlFromCacheRecord'
import { roomHeaderErrorPlaceholderWml, roomHeaderGeneratingPlaceholderWml } from './roomHeaderPlaceholderWml'
import { roomHeaderWmlFromCacheRecord, roomRenderWmlFromCacheRecord } from './roomRenderWmlFromCacheRecord'
import type { EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { isRenderCacheRenderPertainsPayload } from '../renderCache/baseClasses'
import { situationRoomRenderPayloadFromCacheRenderedContent } from '../renderCache/renderedContentToSituationRoomPayload'
import {
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationGenerationStartedPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
} from '../renderOrchestration/publishedEvents'
import { getCharacterRoomPerspectiveKey } from './kickRoomHeaderBroadcast'
import getCurrentTimestamp from '../../internalUtils/dateUtil'

/**
 * TEMPORARY: Word joiner (U+2060) as non-whitespace display title so WML round-trips.
 * `packages/mtw-wml/ts/schema/converters/components.ts` `Render.finalize` currently requires
 * exactly three ordered children (DisplayName, Summary, Description) and rejects an empty
 * DisplayName after trim. Remove this constant once `Render.finalize` (and matching emit/standardize
 * behavior) are loosened so partial or empty DisplayName/Summary can round-trip; then use a normal
 * empty or omitted display name in `placeholderRoomFullWml` instead.
 */
const PLACEHOLDER_RENDER_INVISIBLE_TITLE = '\u2060'

const PLACEHOLDER_RENDER_BODY: EphemeraCacheRenderedContent = {
    displayName: [PLACEHOLDER_RENDER_INVISIBLE_TITLE],
    summary: [''],
    description: [],
}

function placeholderFeatureKnowledgeFullWml(
    componentId: EphemeraFeatureId | EphemeraKnowledgeId,
    bodyText: string
): string {
    const renderedContent: EphemeraCacheRenderedContent = {
        ...PLACEHOLDER_RENDER_BODY,
        description: [bodyText],
    }
    if (isEphemeraFeatureId(componentId)) {
        return featureRenderWmlFromCacheRecord(componentId, renderedContent)
    }
    return knowledgeRenderWmlFromCacheRecord(componentId, renderedContent)
}

/**
 * Object description stub placeholder (PK-6): unlike Feature/Knowledge, there is no `.render`
 * content to fall back through --- `objectRenderWmlFromCacheRecord` reads `displayName` only, so the
 * placeholder body text goes there instead of `description`.
 */
function placeholderObjectFullWml(componentId: EphemeraObjectId, bodyText: string): string {
    return objectRenderWmlFromCacheRecord(componentId, { displayName: [bodyText], description: [] })
}

async function resolveKnowledgeDescriptionTargets(
    registration: PerceptionThreadRegisterKnowledgeDescriptionCommand
): Promise<PublishTarget[]> {
    if (registration.directResponse) {
        const sessionId = await internalCache.Global.get('SessionId')
        return [`SESSION#${sessionId}` as const]
    }
    return [registration.characterId]
}

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
    const occupants = await getRoomCharacterList(roomId)
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

function terminalCreatedTime(thread: { createdTime?: number }): number {
    const t0 = thread.createdTime ?? getCurrentTimestamp()
    return Math.max(t0 + 1, getCurrentTimestamp())
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
    if (isEphemeraFeatureId(payload.componentId) || isEphemeraKnowledgeId(payload.componentId)) {
        await handleFeatureKnowledgeRenderPertains(payload, bus)
        return
    }
    if (isEphemeraObjectId(payload.componentId)) {
        await handleObjectRenderPertains(payload, bus)
        return
    }
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
        bus.publish({
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
            createdTime: terminalCreatedTime(thread),
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
            bus.publish({
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
                createdTime: terminalCreatedTime(thread),
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
            bus.publish({
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
                createdTime: terminalCreatedTime(thread),
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

    const characterMoveContent: RenderContent = {
        type: 'PublishMessage',
        displayProtocol: 'PerceptionMessage',
        wmlContent: terminalHeaderWml,
        metaData: {
            componentUUID: payload.componentId,
            displayMode: 'header',
            roomChannel: 'render',
        },
    }
    const publishedCharacterMove = reportIngressContent(
        bus,
        payload.componentId,
        payload.perspectiveKey,
        'characterMove',
        characterMoveContent
    )

    let fallbackPublished = 0
    let fallbackTargetsMatched = 0
    if (entries.length === 0 && publishedCharacterMove === 0) {
        const fallbackTargets = await resolveFallbackRenderTargetsForPerspective(
            payload.componentId,
            payload.perspectiveKey
        )
        fallbackTargetsMatched = fallbackTargets.length
        if (fallbackTargets.length) {
            bus.publish({
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
        fallbackTargetsMatched,
        fallbackPublished,
    }
    if (entries.length === 0 && publishedCharacterMove === 0) {
        console.warn('[mtw.ephemera.perception] handleRenderPertains: no PerceptionThreads rows or messageOrchestration listeners for bucket; fallback attempted', summary)
    }
    else {
        console.log('[mtw.ephemera.perception] handleRenderPertains', summary)
    }
}

async function handleGenerationStarted(
    payload: import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationStartedPayload,
    bus: MessageBus
): Promise<void> {
    if (isEphemeraFeatureId(payload.componentId) || isEphemeraKnowledgeId(payload.componentId)) {
        await handleFeatureKnowledgeGenerationStarted(payload, bus)
        return
    }
    if (isEphemeraObjectId(payload.componentId)) {
        await handleObjectGenerationStarted(payload, bus)
        return
    }
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
        const t0 = getCurrentTimestamp()
        bus.publish({
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
            createdTime: t0,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'roomDescription', status: 'Generating', messageId, createdTime: t0 }
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
        const t0 = getCurrentTimestamp()
        bus.publish({
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
            createdTime: t0,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'roomHeaderBroadcast', status: 'Generating', messageId, createdTime: t0 }
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
        const t0 = getCurrentTimestamp()
        bus.publish({
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
            createdTime: t0,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'sessionOrientationRender', status: 'Generating', messageId, createdTime: t0 }
        )
    }

    reportIngressContent(bus, payload.componentId, payload.perspectiveKey, 'characterMove', {
        type: 'PublishMessage',
        displayProtocol: 'PerceptionMessage',
        wmlContent: roomHeaderGeneratingPlaceholderWml(payload.componentId),
        metaData: {
            componentUUID: payload.componentId,
            displayMode: 'header',
            status: 'generating',
            roomChannel: 'render',
        },
    })
}

type ErrorLikePayload =
    | import('../renderOrchestration/publishedEvents').RenderOrchestrationOrchestrationErrorPayload
    | import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationDeferredPayload

async function handleOrchestrationErrorOrDeferred(payload: ErrorLikePayload, bus: MessageBus): Promise<void> {
    if (isEphemeraFeatureId(payload.componentId) || isEphemeraKnowledgeId(payload.componentId)) {
        await handleFeatureKnowledgeOrchestrationErrorOrDeferred(payload, bus)
        return
    }
    if (isEphemeraObjectId(payload.componentId)) {
        await handleObjectOrchestrationErrorOrDeferred(payload, bus)
        return
    }
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
        bus.publish({
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
            createdTime: terminalCreatedTime(thread),
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
        bus.publish({
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
            createdTime: terminalCreatedTime(thread),
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
        bus.publish({
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
            createdTime: terminalCreatedTime(thread),
        })

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    reportIngressContent(bus, payload.componentId, payload.perspectiveKey, 'characterMove', {
        type: 'PublishMessage',
        displayProtocol: 'PerceptionMessage',
        wmlContent: roomHeaderErrorPlaceholderWml(payload.componentId),
        metaData: {
            componentUUID: payload.componentId,
            displayMode: 'header',
            roomChannel: 'render',
        },
    })
}

async function handleFeatureKnowledgeRenderPertains(
    payload: import('../renderCache/baseClasses').RenderCacheRenderPertainsPayload,
    bus: MessageBus
): Promise<void> {
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    const componentId = payload.componentId
    const terminalFeatureWml = isEphemeraFeatureId(componentId)
        ? featureRenderWmlFromCacheRecord(componentId, payload.cacheRecord.renderedContent)
        : undefined
    const terminalKnowledgeWml = isEphemeraKnowledgeId(componentId)
        ? knowledgeRenderWmlFromCacheRecord(componentId, payload.cacheRecord.renderedContent)
        : undefined

    let publishedFeatureDescription = 0
    let skippedFeatureDescriptionTerminal = 0
    let publishedKnowledgeDescription = 0
    let skippedKnowledgeDescriptionTerminal = 0

    for (const entry of entries) {
        if (!isFeatureDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'featureDescription' || !isEphemeraFeatureId(componentId)) {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Render Pertains', payload.componentId, payload.perspectiveKey, registrationId)
            skippedFeatureDescriptionTerminal += 1
            continue
        }
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.publish({
            type: 'PublishMessage',
            targets: [registration.characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: terminalFeatureWml!,
            metaData: {
                componentUUID: componentId,
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: terminalCreatedTime(thread),
        })
        publishedFeatureDescription += 1
        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isKnowledgeDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'knowledgeDescription' || !isEphemeraKnowledgeId(componentId)) {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Render Pertains', payload.componentId, payload.perspectiveKey, registrationId)
            skippedKnowledgeDescriptionTerminal += 1
            continue
        }
        const targets = await resolveKnowledgeDescriptionTargets(registration)
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.publish({
            type: 'PublishMessage',
            targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: terminalKnowledgeWml!,
            metaData: {
                componentUUID: componentId,
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: terminalCreatedTime(thread),
        })
        publishedKnowledgeDescription += 1
        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    console.log('[mtw.ephemera.perception] handleFeatureKnowledgeRenderPertains', {
        componentId: payload.componentId,
        perspectiveKey: payload.perspectiveKey,
        cacheId: payload.cacheId,
        bucketSize: entries.length,
        publishedFeatureDescription,
        skippedFeatureDescriptionTerminal,
        publishedKnowledgeDescription,
        skippedKnowledgeDescriptionTerminal,
    })
}

async function handleFeatureKnowledgeGenerationStarted(
    payload: import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationStartedPayload,
    bus: MessageBus
): Promise<void> {
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    const componentId = payload.componentId

    for (const entry of entries) {
        if (!isFeatureDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'featureDescription' || !isEphemeraFeatureId(componentId)) {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Generation Started', payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const messageId = `MESSAGE#${uuidv4()}`
        const t0 = getCurrentTimestamp()
        bus.publish({
            type: 'PublishMessage',
            targets: [registration.characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderFeatureKnowledgeFullWml(componentId, 'Generating'),
            metaData: {
                componentUUID: componentId,
                status: 'generating',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: t0,
        })
        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'featureDescription', status: 'Generating', messageId, createdTime: t0 }
        )
    }

    for (const entry of entries) {
        if (!isKnowledgeDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'knowledgeDescription' || !isEphemeraKnowledgeId(componentId)) {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Generation Started', payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const targets = await resolveKnowledgeDescriptionTargets(registration)
        const messageId = `MESSAGE#${uuidv4()}`
        const t0 = getCurrentTimestamp()
        bus.publish({
            type: 'PublishMessage',
            targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderFeatureKnowledgeFullWml(componentId, 'Generating'),
            metaData: {
                componentUUID: componentId,
                status: 'generating',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: t0,
        })
        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'knowledgeDescription', status: 'Generating', messageId, createdTime: t0 }
        )
    }
}

async function handleFeatureKnowledgeOrchestrationErrorOrDeferred(
    payload: ErrorLikePayload,
    bus: MessageBus
): Promise<void> {
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    const componentId = payload.componentId

    for (const entry of entries) {
        if (!isFeatureDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'featureDescription' || !isEphemeraFeatureId(componentId)) {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe(payload.type, payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.publish({
            type: 'PublishMessage',
            targets: [registration.characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderFeatureKnowledgeFullWml(componentId, 'Error'),
            metaData: {
                componentUUID: componentId,
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: terminalCreatedTime(thread),
        })
        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    for (const entry of entries) {
        if (!isKnowledgeDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'knowledgeDescription' || !isEphemeraKnowledgeId(componentId)) {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe(payload.type, payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const targets = await resolveKnowledgeDescriptionTargets(registration)
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.publish({
            type: 'PublishMessage',
            targets,
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderFeatureKnowledgeFullWml(componentId, 'Error'),
            metaData: {
                componentUUID: componentId,
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: terminalCreatedTime(thread),
        })
        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }
}

/**
 * Object description stub fan-in (PK-6): single-viewer, terminal-only-once, mirrors
 * handleFeatureKnowledge*'s featureDescription arm exactly (no directResponse/SESSION# targeting ---
 * Object has no such concept).
 */
async function handleObjectRenderPertains(
    payload: import('../renderCache/baseClasses').RenderCacheRenderPertainsPayload,
    bus: MessageBus
): Promise<void> {
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    const componentId = payload.componentId
    if (!isEphemeraObjectId(componentId)) {
        return
    }
    const terminalObjectWml = objectRenderWmlFromCacheRecord(componentId, payload.cacheRecord.renderedContent)

    let publishedObjectDescription = 0
    let skippedObjectDescriptionTerminal = 0

    for (const entry of entries) {
        if (!isObjectDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'objectDescription') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Render Pertains', payload.componentId, payload.perspectiveKey, registrationId)
            skippedObjectDescriptionTerminal += 1
            continue
        }
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.publish({
            type: 'PublishMessage',
            targets: [registration.characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: terminalObjectWml,
            metaData: {
                componentUUID: componentId,
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: terminalCreatedTime(thread),
        })
        publishedObjectDescription += 1
        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    console.log('[mtw.ephemera.perception] handleObjectRenderPertains', {
        componentId: payload.componentId,
        perspectiveKey: payload.perspectiveKey,
        cacheId: payload.cacheId,
        bucketSize: entries.length,
        publishedObjectDescription,
        skippedObjectDescriptionTerminal,
    })
}

async function handleObjectGenerationStarted(
    payload: import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationStartedPayload,
    bus: MessageBus
): Promise<void> {
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    const componentId = payload.componentId
    if (!isEphemeraObjectId(componentId)) {
        return
    }

    for (const entry of entries) {
        if (!isObjectDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'objectDescription') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe('Generation Started', payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const messageId = `MESSAGE#${uuidv4()}`
        const t0 = getCurrentTimestamp()
        bus.publish({
            type: 'PublishMessage',
            targets: [registration.characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderObjectFullWml(componentId, 'Generating'),
            metaData: {
                componentUUID: componentId,
                status: 'generating',
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: t0,
        })
        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'objectDescription', status: 'Generating', messageId, createdTime: t0 }
        )
    }
}

async function handleObjectOrchestrationErrorOrDeferred(payload: ErrorLikePayload, bus: MessageBus): Promise<void> {
    const entries = internalCache.PerceptionThreads.list(payload.componentId, payload.perspectiveKey)
    const componentId = payload.componentId
    if (!isEphemeraObjectId(componentId)) {
        return
    }

    for (const entry of entries) {
        if (!isObjectDescriptionPerceptionThread(entry.thread)) {
            continue
        }
        const { thread, registration, registrationId } = entry
        if (registration.threadKind !== 'objectDescription') {
            continue
        }
        if (thread.status === 'Terminal') {
            logTerminalDedupe(payload.type, payload.componentId, payload.perspectiveKey, registrationId)
            continue
        }
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        bus.publish({
            type: 'PublishMessage',
            targets: [registration.characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderObjectFullWml(componentId, 'Error'),
            metaData: {
                componentUUID: componentId,
            },
            messageGroupId: registration.messageGroupId,
            messageId,
            createdTime: terminalCreatedTime(thread),
        })
        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }
}
