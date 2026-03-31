import type { MessageBus } from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import {
    CONVERSATION_PAYLOAD_STUB,
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    registerConversation,
    type ConversationId,
} from '../conversations'
import { isConversationCompositeReadHandleGenerateRoomPreview } from '../conversations/conversationTypes'
import { computePerspectiveKey, perspectiveMatches } from '@tonylb/mtw-interfaces/ts/perspective'
import { markStatesEqual } from '../renderCache/markStateUtils'

import {
    isRenderOrchestrationRequestMessage,
    isRenderPreviewRequested,
    isRenderRequested,
    type RenderPreviewRequested,
    type RenderRequested,
} from './events'
import { orchestratePassiveRenderRequestedBatch } from './passiveRenderOrchestration'
import { findRender } from './findRender'
import { generateRoomPreview } from './generateRoomPreview'
import { isRenderResolveInputSuccess, type RenderResolveInput } from './baseClasses'

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
    isRenderError,
    isRenderInvalidate,
    isRenderGenerationStarted,
    isRenderReady,
    isRenderGenerationCompleted,
    isRenderGenerationFailed,
    toRenderError,
    toRenderInvalidate,
    toRenderReady,
} from './events'
export type {
    RenderComponentId,
    RenderComponentPerspective,
    RenderRoomPerspective,
    RenderOrchestrationRequestMessage,
    RenderRequested,
    RenderRequestedBusDeliveryFields,
    RenderPreviewRequested,
    RenderError,
    RenderInvalidate,
    RenderGenerationStarted,
    RenderReady,
    RenderGenerationCompleted,
    RenderGenerationFailed,
    RenderOrchestrationMessage,
} from './events'

export { intakeRenderRequested } from './requestIntake'
export type { RequestIntakeDependencies } from './requestIntake'

export {
    orchestratePassiveRenderRequestedBatch,
    requestIntakeMessage,
} from './passiveRenderOrchestration'
export type {
    PassiveOrchestrationDependencies,
    PassiveRenderPipelineDependencies,
} from './passiveRenderOrchestration'

export type {
    PassiveIntakeResult,
    PassiveIntakeResultMarksMissing,
    PassiveIntakeResultNotRoom,
    PassiveIntakeResultOk,
} from './renderIntake'

export { generateRoomPreview, defaultPublishPutCacheRecord } from './generateRoomPreview'
export type {
    GenerateRoomPreviewGenerationReturn,
    GenerateRoomPreviewInput,
    GenerateRoomPreviewOptions,
} from './generateRoomPreview'

export type {
    RenderResolveInputError,
    RenderResolveInputErrorCode,
    RenderResolveErrorCode,
    RenderResolveInput,
    RenderResolveInputSuccess,
    RenderResolveMarkProvenance,
    RenderResolveOutput,
    RenderResolveOutputFailed,
    RenderResolveOutputInvalidate,
    RenderResolveOutputResolved,
} from './baseClasses'

export {
    isRenderResolveInputSuccess,
    RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
} from './baseClasses'

export { findRender } from './findRender'
export type { FindRenderDependencies } from './findRender'

export { RENDER_ERROR_CODE_NOT_ROOM } from '../conversations/conversationTypes/roomStateRender/baseClasses'

export type RenderOrchestrationSubscriptions = {
    /**
     * Unsubscribe all handlers registered by `registerRenderOrchestration`.
     *
     * Note: MessageBus today does not expose an unsubscribe API; this is future-facing
     * and currently a no-op placeholder so call sites can adopt the shape without churn.
     */
    unsubscribeAll: () => void;
}

/** A-phase adapter: preview bus message to shared resolve input (see AGENT.planning.simplification.md). */
const intakeRenderPreviewRequested = (payload: RenderPreviewRequested): RenderResolveInput => ({
    type: 'success',
    roomId: payload.componentId,
    perspective: payload.perspective,
    markState: payload.markState,
    markProvenance: 'preview',
    allowGeneration: payload.allowGeneration,
    generationContextWml: payload.generationContextWml,
})

const handleRenderPreviewRequested = async (payload: RenderPreviewRequested): Promise<void> => {
    const conversationId: ConversationId =
        payload.conversationId !== undefined
            ? payload.conversationId
            : await registerConversation({
                type: CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
                routing: {
                    roomId: payload.componentId,
                    perspectiveId: computePerspectiveKey(payload.perspective.assetStack),
                    ...(payload.requestId !== undefined ? { requestId: payload.requestId } : {}),
                },
                payload: CONVERSATION_PAYLOAD_STUB,
            })

    const composite = internalCache.Conversations.get(conversationId)
    const rawHandle = composite?.handle
    const handle =
        rawHandle !== undefined && isConversationCompositeReadHandleGenerateRoomPreview(rawHandle)
            ? rawHandle
            : undefined

    if (handle === undefined) {
        console.error('Conversations.get: missing or non-generateRoomPreview handle after registerConversation', {
            conversationId,
            compositeFound: composite !== undefined,
            compositeHandleKind: rawHandle?.kind,
        })
    }

    const resolve = intakeRenderPreviewRequested(payload)
    if (isRenderResolveInputSuccess(resolve)) {
        await findRender(resolve, {
            getExactMatch: (input) => internalCache.RenderCache.getExactMatch(input),
            getCacheRecordById: async () => undefined,
            clearPerspectivePointer: async () => {},
            computePerspectiveKey,
            markStatesEqual,
            perspectiveMatches,
            sendMessage: async (arg) => {
                await handle?.sendMessage(arg)
            },
            generateRoomPreview,
            conversationId,
        })
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
        renderRequested.length > 0 ? orchestratePassiveRenderRequestedBatch({ payloads: renderRequested, messageBus }) : Promise.resolve(),
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
