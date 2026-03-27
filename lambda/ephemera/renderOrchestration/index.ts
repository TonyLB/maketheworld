import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import { isConversationCompositeReadHandleGenerateRoomPreview } from '../conversations/conversationTypes'

import {
    isRenderOrchestrationRequestMessage,
    isRenderPreviewRequested,
    isRenderRequested,
    type RenderPreviewRequested,
    type RenderRequested,
} from './events'
import requestIntakeMessage from './requestIntake'
import { generateRoomPreview } from './generateRoomPreview'

/**
 * renderOrchestration public module surface
 *
 * v2 intent: treat renderOrchestration as a messageBus-driven subsystem.
 *
 * This file provides:
 * - a single registration entrypoint to wire handler subscriptions onto a MessageBus
 * - a small export surface for direct-call wedges that still exist (e.g. `generateRoomPreview`)
 *
 * Note: The preview wedge currently streams progress/results via `conversations` (ConversationStep)
 * rather than subscribing to `RenderGenerationStarted` / `RenderReady`. Bridging those is planned,
 * but intentionally not forced here.
 */

export {
    isRenderOrchestrationMessage,
    isRenderOrchestrationRequestMessage,
    isRenderRequested,
    isRenderPreviewRequested,
    isRenderLookupRequested,
    isRenderGenerationStarted,
    isRenderReady,
    isRenderGenerationCompleted,
    isRenderGenerationFailed,
} from './events'
export type {
    RenderComponentId,
    RenderOrchestrationRequestMessage,
    RenderRequested,
    RenderPreviewRequested,
    RenderLookupRequested,
    RenderGenerationStarted,
    RenderReady,
    RenderGenerationCompleted,
    RenderGenerationFailed,
    RenderOrchestrationMessage,
} from './events'

export { default as requestIntakeMessage } from './requestIntake'
export type { RequestIntakeDependencies } from './requestIntake'

export { generateRoomPreview, defaultPublishPutCacheRecord } from './generateRoomPreview'
export type { GenerateRoomPreviewInput, GenerateRoomPreviewOptions } from './generateRoomPreview'

export type { RenderResolveInput, RenderResolveMarkProvenance } from './baseClasses'

export type RenderOrchestrationSubscriptions = {
    /**
     * Unsubscribe all handlers registered by `registerRenderOrchestration`.
     *
     * Note: MessageBus today does not expose an unsubscribe API; this is future-facing
     * and currently a no-op placeholder so call sites can adopt the shape without churn.
     */
    unsubscribeAll: () => void;
}

const handleRenderPreviewRequested = async (payload: RenderPreviewRequested): Promise<void> => {
    const composite = internalCache.Conversations.get(payload.conversationId)
    const rawHandle = composite?.handle
    const handle =
        rawHandle !== undefined && isConversationCompositeReadHandleGenerateRoomPreview(rawHandle)
            ? rawHandle
            : undefined

    if (handle === undefined) {
        console.error('Conversations.get: missing or non-generateRoomPreview handle after registerConversation', {
            conversationId: payload.conversationId,
            compositeFound: composite !== undefined,
            compositeHandleKind: rawHandle?.kind,
        })
    }

    const perspective = { assetStack: payload.perspective.assetStack as AssetUUID[] }
    const exactMatch = await internalCache.RenderCache.getExactMatch({
        componentId: payload.componentId,
        proposedMarkState: payload.markState,
        perspective,
    })
    if (exactMatch) {
        if (handle !== undefined) {
            await handle.sendMessage({
                success: true,
                renderedContent: exactMatch.renderedContent,
            })
        }
        return
    }

    const result = await generateRoomPreview(
        {
            roomId: payload.componentId,
            markState: payload.markState,
            assetStack: payload.perspective.assetStack,
            generationContextWml: payload.generationContextWml,
        },
        {
            conversationId: payload.conversationId,
            onGenerating: async () => {
                await handle?.sendMessage('generating')
            },
        }
    )
    if (handle !== undefined) {
        await handle.sendMessage(result)
    }
}

/**
 * Central dispatch for render "request" messages: passive {@link RenderRequested} (intake / lookup)
 * and authoring {@link RenderPreviewRequested} (room preview + conversation streaming).
 *
 * Matches the standard messageBus callback shape used elsewhere (`{ payloads, messageBus }`).
 */
export const handleRenderOrchestrationMessage = async ({
    payloads,
    messageBus,
}: {
    payloads: (RenderRequested | RenderPreviewRequested)[];
    messageBus: MessageBus;
}): Promise<void> => {
    const renderRequested = payloads.filter(isRenderRequested)
    const renderPreviewRequested = payloads.filter(isRenderPreviewRequested)

    await Promise.all([
        renderRequested.length > 0 ? requestIntakeMessage({ payloads: renderRequested, messageBus }) : Promise.resolve(),
        Promise.all(renderPreviewRequested.map((p) => handleRenderPreviewRequested(p))),
    ])
}

/**
 * Wire renderOrchestration handlers onto a MessageBus.
 *
 * This is the primary "make it real" integration point: once called, publishing
 * `RenderRequested` or `RenderPreviewRequested` into the bus will execute orchestration.
 */
export const registerRenderOrchestration = (messageBus: MessageBus): RenderOrchestrationSubscriptions => {
    messageBus.subscribe({
        tag: 'RenderOrchestration.Requests',
        priority: 5,
        filter: isRenderOrchestrationRequestMessage,
        callback: handleRenderOrchestrationMessage,
    })

    return {
        unsubscribeAll: () => {
            // no-op until MessageBus exposes unsubscribe
        },
    }
}
