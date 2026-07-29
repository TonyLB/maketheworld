/**
 * Room header broadcast (the sole remaining `PerceptionThreads`-registered kind in this file):
 * correlate renderOrchestration / renderCache streams to Perception Thread Registered rows.
 * roomDescription/featureDescription/knowledgeDescription/objectDescription/sessionOrientationRender
 * report into messageOrchestration's ingress registry instead (Phase 7) --- see
 * `reportIngressContent` calls below and `dataSource/messageOrchestration/AGENT.md`.
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
import { getRoomCharacterList } from '../../internalCache/hydrateRoomRoster'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import { isRoomHeaderBroadcastPerceptionThread } from '../../internalCache/perceptionThreads'
import { reportIngressContent } from '../messageOrchestration'
import type { RenderContent } from '../messageOrchestration/contentIngress'
import {
    featureRenderWmlFromCacheRecord,
    knowledgeRenderWmlFromCacheRecord,
} from './featureKnowledgeRenderWmlFromCacheRecord'
import { objectRenderWmlFromCacheRecord } from './objectRenderWmlFromCacheRecord'
import { roomHeaderErrorPlaceholderWml, roomHeaderGeneratingPlaceholderWml } from './roomHeaderPlaceholderWml'
import { roomHeaderWmlFromCacheRecord } from './roomRenderWmlFromCacheRecord'
import type { EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { isRenderCacheRenderPertainsPayload } from '../renderCache/baseClasses'
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
 * empty or omitted display name here instead. (A sibling copy of this constant lives in
 * `roomFullPlaceholderWml.ts`, for the room-shaped placeholder that moved there in Phase 7.)
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
    const terminalHeaderWml = roomHeaderWmlFromCacheRecord(
        payload.componentId,
        payload.cacheRecord.renderedContent
    )

    let publishedHeaderBroadcast = 0
    let skippedHeaderTerminal = 0
    let skippedHeaderEmptyTargets = 0
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

    // Shared by every messageOrchestration listener registered for this (componentId,
    // perspectiveKey, 'render') bucket --- characterMove, roomDescription, and
    // sessionOrientationRender all register here now (Phase 7); each projects this same raw cache
    // record into its own header/full envelope in deliverListenerContent.
    const roomRenderContent: RenderContent = {
        kind: 'roomRender',
        componentId: payload.componentId,
        renderedContent: payload.cacheRecord.renderedContent,
    }
    const publishedRoomRenderListeners = reportIngressContent(
        bus,
        payload.componentId,
        payload.perspectiveKey,
        'render',
        roomRenderContent
    )

    let fallbackPublished = 0
    let fallbackTargetsMatched = 0
    if (entries.length === 0 && publishedRoomRenderListeners === 0) {
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
        publishedHeaderBroadcast,
        skippedHeaderTerminal,
        skippedHeaderEmptyTargets,
        publishedRoomRenderListeners,
        fallbackTargetsMatched,
        fallbackPublished,
    }
    if (entries.length === 0 && publishedRoomRenderListeners === 0) {
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
            messageId,
            createdTime: t0,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { threadKind: 'roomHeaderBroadcast', status: 'Generating', messageId, createdTime: t0 }
        )
    }

    reportIngressContent(bus, payload.componentId, payload.perspectiveKey, 'render', {
        kind: 'roomPlaceholder',
        componentId: payload.componentId,
        bodyText: 'Generating',
        status: 'generating',
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
            messageId,
            createdTime: terminalCreatedTime(thread),
        })

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }

    reportIngressContent(bus, payload.componentId, payload.perspectiveKey, 'render', {
        kind: 'roomPlaceholder',
        componentId: payload.componentId,
        bodyText: 'Error',
    })
}

/**
 * Feature/Knowledge `metaData.componentUUID` is a discriminated-union key (`PerceptionMessageMetaData`,
 * one member per `ASSET#`/`FEATURE#`/etc. prefix) --- building `content` inside each `isEphemeraFeatureId`/
 * `isEphemeraKnowledgeId` branch (rather than from a post-guard `EphemeraFeatureId | EphemeraKnowledgeId`
 * union componentId) is what lets each branch's `componentUUID` narrow to one single template-literal
 * member instead of the union TS can't match against any one variant.
 */
function featureKnowledgeLiteralContent(
    componentId: EphemeraFeatureId | EphemeraKnowledgeId,
    wmlContent: string,
    extraMetaData: { status: 'generating' } | {} = {}
): RenderContent {
    if (isEphemeraFeatureId(componentId)) {
        return {
            kind: 'literal',
            message: {
                type: 'PublishMessage',
                displayProtocol: 'PerceptionMessage',
                wmlContent,
                metaData: { componentUUID: componentId, ...extraMetaData },
            },
        }
    }
    return {
        kind: 'literal',
        message: {
            type: 'PublishMessage',
            displayProtocol: 'PerceptionMessage',
            wmlContent,
            metaData: { componentUUID: componentId, ...extraMetaData },
        },
    }
}

async function handleFeatureKnowledgeRenderPertains(
    payload: import('../renderCache/baseClasses').RenderCacheRenderPertainsPayload,
    bus: MessageBus
): Promise<void> {
    const componentId = payload.componentId
    const wmlContent = isEphemeraFeatureId(componentId)
        ? featureRenderWmlFromCacheRecord(componentId, payload.cacheRecord.renderedContent)
        : isEphemeraKnowledgeId(componentId)
            ? knowledgeRenderWmlFromCacheRecord(componentId, payload.cacheRecord.renderedContent)
            : undefined
    if (wmlContent === undefined || (!isEphemeraFeatureId(componentId) && !isEphemeraKnowledgeId(componentId))) {
        return
    }
    const publishedListeners = reportIngressContent(
        bus, componentId, payload.perspectiveKey, 'render',
        featureKnowledgeLiteralContent(componentId, wmlContent)
    )
    console.log('[mtw.ephemera.perception] handleFeatureKnowledgeRenderPertains', {
        componentId: payload.componentId,
        perspectiveKey: payload.perspectiveKey,
        cacheId: payload.cacheId,
        publishedListeners,
    })
}

async function handleFeatureKnowledgeGenerationStarted(
    payload: import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationStartedPayload,
    bus: MessageBus
): Promise<void> {
    const componentId = payload.componentId
    if (!isEphemeraFeatureId(componentId) && !isEphemeraKnowledgeId(componentId)) {
        return
    }
    reportIngressContent(
        bus, componentId, payload.perspectiveKey, 'render',
        featureKnowledgeLiteralContent(componentId, placeholderFeatureKnowledgeFullWml(componentId, 'Generating'), { status: 'generating' })
    )
}

async function handleFeatureKnowledgeOrchestrationErrorOrDeferred(
    payload: ErrorLikePayload,
    bus: MessageBus
): Promise<void> {
    const componentId = payload.componentId
    if (!isEphemeraFeatureId(componentId) && !isEphemeraKnowledgeId(componentId)) {
        return
    }
    reportIngressContent(
        bus, componentId, payload.perspectiveKey, 'render',
        featureKnowledgeLiteralContent(componentId, placeholderFeatureKnowledgeFullWml(componentId, 'Error'))
    )
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
    const componentId = payload.componentId
    if (!isEphemeraObjectId(componentId)) {
        return
    }
    const wmlContent = objectRenderWmlFromCacheRecord(componentId, payload.cacheRecord.renderedContent)
    const publishedListeners = reportIngressContent(bus, componentId, payload.perspectiveKey, 'render', {
        kind: 'literal',
        message: {
            type: 'PublishMessage',
            displayProtocol: 'PerceptionMessage',
            wmlContent,
            metaData: { componentUUID: componentId },
        },
    })
    console.log('[mtw.ephemera.perception] handleObjectRenderPertains', {
        componentId: payload.componentId,
        perspectiveKey: payload.perspectiveKey,
        cacheId: payload.cacheId,
        publishedListeners,
    })
}

async function handleObjectGenerationStarted(
    payload: import('../renderOrchestration/publishedEvents').RenderOrchestrationGenerationStartedPayload,
    bus: MessageBus
): Promise<void> {
    const componentId = payload.componentId
    if (!isEphemeraObjectId(componentId)) {
        return
    }
    reportIngressContent(bus, componentId, payload.perspectiveKey, 'render', {
        kind: 'literal',
        message: {
            type: 'PublishMessage',
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderObjectFullWml(componentId, 'Generating'),
            metaData: { componentUUID: componentId, status: 'generating' },
        },
    })
}

async function handleObjectOrchestrationErrorOrDeferred(payload: ErrorLikePayload, bus: MessageBus): Promise<void> {
    const componentId = payload.componentId
    if (!isEphemeraObjectId(componentId)) {
        return
    }
    reportIngressContent(bus, componentId, payload.perspectiveKey, 'render', {
        kind: 'literal',
        message: {
            type: 'PublishMessage',
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderObjectFullWml(componentId, 'Error'),
            metaData: { componentUUID: componentId },
        },
    })
}
