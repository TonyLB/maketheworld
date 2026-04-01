import type { MessageBus } from '../messageBus/baseClasses'

import {
    isRenderOrchestrationRequestMessage,
    type RenderPreviewRequested,
    type RenderRequested,
} from './events'
import { orchestrateRenderRequest } from './orchestrationHandler'

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

export { orchestrateRenderRequest } from './orchestrationHandler'
export type {
    OrchestrationHandlerDependencies,
    OrchestrationPipelineDependencies,
} from './orchestrationHandler'

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

export { deliverIntakeErrorsIfAny } from './intakeErrors'

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
    await Promise.all(payloads.map((payload) => orchestrateRenderRequest({ payload, messageBus })))
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
