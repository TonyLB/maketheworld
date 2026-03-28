import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import type { ConversationId } from '../conversations/conversationTypes/baseClasses'
import {
    isConversationCompositeReadHandleGenerateRoomPreview,
    type ConversationCompositeReadHandleGenerateRoomPreview,
} from '../conversations/conversationTypes'

import {
    isRenderOrchestrationRequestMessage,
    isRenderPreviewRequested,
    isRenderRequested,
    type RenderPreviewRequested,
    type RenderRequested,
} from './events'
import requestIntakeMessage from './requestIntake'
import { generateRoomPreview } from './generateRoomPreview'
import type { RenderResolveInput, RenderResolveOutput } from './baseClasses'

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

export type {
    RenderResolveErrorCode,
    RenderResolveInput,
    RenderResolveMarkProvenance,
    RenderResolveOutput,
    RenderResolveOutputFailed,
    RenderResolveOutputLookupHandoff,
    RenderResolveOutputResolved,
} from './baseClasses'

export type RenderOrchestrationSubscriptions = {
    /**
     * Unsubscribe all handlers registered by `registerRenderOrchestration`.
     *
     * Note: MessageBus today does not expose an unsubscribe API; this is future-facing
     * and currently a no-op placeholder so call sites can adopt the shape without churn.
     */
    unsubscribeAll: () => void;
}

/** A-phase adapter: bus message to shared resolve input (see AGENT.planning.simplification.md). */
const mapRenderPreviewRequestedToResolveInput = (payload: RenderPreviewRequested): RenderResolveInput => ({
    roomId: payload.componentId,
    perspective: payload.perspective,
    markState: payload.markState,
    markProvenance: 'preview',
    allowGeneration: payload.allowGeneration,
    generationContextWml: payload.generationContextWml,
})

/** Core: exact-match then generation; returns {@link RenderResolveOutput} (no delivery). */
const executePreviewRenderResolve = async (
    resolve: RenderResolveInput,
    options: {
        conversationId: ConversationId;
        onGenerating?: () => Promise<void>;
    }
): Promise<RenderResolveOutput> => {
    const exactMatch = await internalCache.RenderCache.getExactMatch({
        componentId: resolve.roomId,
        proposedMarkState: resolve.markState,
        perspective: resolve.perspective,
    })
    if (exactMatch) {
        return {
            type: 'resolved',
            renderedContent: exactMatch.renderedContent,
            cacheId: exactMatch.DataCategory as EphemeraCacheId,
            cacheRecord: exactMatch,
        }
    }

    const result = await generateRoomPreview(
        {
            roomId: resolve.roomId,
            markState: resolve.markState,
            assetStack: resolve.perspective.assetStack,
            generationContextWml: resolve.generationContextWml,
        },
        {
            conversationId: options.conversationId,
            onGenerating: options.onGenerating,
        }
    )
    if (result.success) {
        return {
            type: 'resolved',
            renderedContent: result.renderedContent,
        }
    }
    return {
        type: 'failed',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
    }
}

/** Maps {@link RenderResolveOutput} to the conversation `GenerateRoomPreview` terminal wire shape. */
const deliverPreviewRenderResolveOutput = async (
    output: RenderResolveOutput,
    handle: ConversationCompositeReadHandleGenerateRoomPreview | undefined
): Promise<void> => {
    if (handle === undefined) {
        return
    }
    if (output.type === 'resolved') {
        await handle.sendMessage({
            success: true,
            renderedContent: output.renderedContent,
        })
        return
    }
    if (output.type === 'lookup_handoff') {
        console.error('preview path produced unexpected lookup_handoff outcome')
        return
    }
    const { errorCode, errorMessage } = output
    if (errorCode === 'META_ROOM_MARKS_MISSING') {
        console.error('preview path produced unexpected META_ROOM_MARKS_MISSING outcome')
        return
    }
    await handle.sendMessage({
        success: false,
        errorCode,
        errorMessage,
    })
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

    const resolve = mapRenderPreviewRequestedToResolveInput(payload)
    const output = await executePreviewRenderResolve(resolve, {
        conversationId: payload.conversationId,
        onGenerating: async () => {
            await handle?.sendMessage('generating')
        },
    })
    await deliverPreviewRenderResolveOutput(output, handle)
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
