/**
 * Room description fan-in: correlate renderOrchestration / renderCache streams to Perception Thread Registered rows.
 */
import { randomUUID } from 'crypto'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import { isRoomDescriptionPerceptionThread } from '../../internalCache/perceptionThreads'
import { isRenderCacheRenderPertainsPayload } from '../renderCache/baseClasses'
import {
    isRenderOrchestrationGenerationDeferredPayload,
    isRenderOrchestrationGenerationStartedPayload,
    isRenderOrchestrationOrchestrationErrorPayload,
} from '../renderOrchestration/publishedEvents'

function placeholderRoomFullWml(roomId: EphemeraRoomId, bodyText: string): string {
    const exKey = 'EXAMPLE#perception-placeholder' as ComponentUUID
    const ex = new StandardExample({
        tag: 'Example',
        universalKey: exKey,
        description: [bodyText],
        marks: [],
    })
    const roomRow: StandardRoomData = {
        tag: 'Room',
        universalKey: roomId,
        examples: [exKey],
    }
    const form = new StandardForm([
        { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
        roomRow,
        ex.toJSON(),
    ])
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
            continue
        }
        const characterId = registration.characterId

        const roomDescribe = await internalCache.ComponentRender.get(characterId, payload.componentId)
        const messageId = thread.messageId ?? `MESSAGE#${randomUUID()}`
        bus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: schemaToWML([roomDescribe.schema]),
            metaData: {
                componentUUID: payload.componentId,
                displayMode: 'full',
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

        const messageId = `MESSAGE#${randomUUID()}`
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
            },
            messageGroupId: registration.messageGroupId,
            messageId,
        })

        internalCache.PerceptionThreads.update(
            { componentId: payload.componentId, perspectiveKey: payload.perspectiveKey, registrationId },
            { status: 'Generating', messageId }
        )
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
        const messageId = thread.messageId ?? `MESSAGE#${randomUUID()}`
        bus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'PerceptionMessage',
            wmlContent: placeholderRoomFullWml(roomId, 'Error'),
            metaData: {
                componentUUID: roomId,
                displayMode: 'full',
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
}
