import type { MessageBus } from '../messageBus/baseClasses'

import {
    isRenderRequested,
    type RenderRequested,
} from './events'
import requestIntakeMessage from './requestIntake'

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
 * Wire renderOrchestration handlers onto a MessageBus.
 *
 * This is the primary "make it real" integration point: once called, publishing
 * `RenderRequested` into the bus will execute the orchestration cascade.
 */
export const registerRenderOrchestration = (messageBus: MessageBus): RenderOrchestrationSubscriptions => {
    //
    // Handler A: request intake (fast-path pointer hit -> RenderReady, else handoff)
    //
    messageBus.subscribe({
        tag: 'RenderOrchestration.RequestIntake',
        priority: 5,
        filter: isRenderRequested,
        callback: requestIntakeMessage,
    })

    //
    // Handler B/C: not yet wired here.
    //
    // When implemented, this module should subscribe:
    // - RenderLookupRequested -> exact-match lookup (publish RenderReady on hit)
    // - generation work messages -> generation + pointer update + RenderReady
    //
    // For now, keep the intent obvious but avoid premature wiring.
    //
    return {
        unsubscribeAll: () => {
            // no-op until MessageBus exposes unsubscribe
        },
    }
}

/**
 * Convenience helper for publishing RenderRequested.
 *
 * Prefer using `messageBus.send(...)` directly when a call site already has the message object;
 * this helper exists to make "use renderOrchestration" read naturally at call sites.
 */
export const publishRenderRequested = (messageBus: MessageBus, payload: RenderRequested): void => {
    messageBus.send(payload)
}

