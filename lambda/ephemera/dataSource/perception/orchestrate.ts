/**
 * Room description and room header broadcast fan-in: correlate renderOrchestration / renderCache streams
 * to Perception Thread Registered rows.
 */
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import type { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'
import {
    isCharacterMovePerceptionThread,
    isRoomDescriptionPerceptionThread,
    isRoomHeaderBroadcastPerceptionThread,
} from '../../internalCache/perceptionThreads'
import type { PerceptionThreadRegisterCharacterMoveCommand } from './localApiEvents'
import { roomHeaderErrorPlaceholderWml, roomHeaderGeneratingPlaceholderWml } from './roomHeaderPlaceholderWml'
import { roomRenderWmlFromCacheRecord } from './roomRenderWmlFromCacheRecord'
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

function headerTargetsForCharacterMove(
    registration: PerceptionThreadRegisterCharacterMoveCommand
): EphemeraCharacterId[] {
    return registration.headerTargets?.length ? registration.headerTargets : [registration.characterId]
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
                wmlContent: terminalRenderWml,
                metaData: {
                    componentUUID: roomId,
                    displayMode: 'header',
                    roomChannel: 'render',
                },
                messageGroupId: registration.messageGroupId,
                messageId,
            })
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
            continue
        }
        const targets = headerTargetsForCharacterMove(registration)
        const roomId = payload.componentId
        const messageId = thread.messageId ?? `MESSAGE#${uuidv4()}`
        if (targets.length) {
            bus.send({
                type: 'PublishMessage',
                targets,
                displayProtocol: 'PerceptionMessage',
                wmlContent: terminalRenderWml,
                metaData: {
                    componentUUID: roomId,
                    displayMode: 'header',
                    roomChannel: 'render',
                },
                messageGroupId: registration.messageGroupId,
                messageId,
            })
        }

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

        internalCache.PerceptionThreads.remove({
            componentId: payload.componentId,
            perspectiveKey: payload.perspectiveKey,
            registrationId,
        })
    }
}
