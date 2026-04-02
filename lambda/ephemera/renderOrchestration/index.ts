/**
 * renderOrchestration public module surface
 *
 * v2 intent: treat renderOrchestration as a messageBus-driven subsystem.
 *
 * This file provides a small export surface for direct-call wedges that still exist
 * (e.g. `generateRoomPreview`) and shared types/utilities for orchestration consumers.
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
} from '../dataSource/renderOrchestration/events'
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
} from '../dataSource/renderOrchestration/events'

export { intakeRenderRequested } from '../dataSource/renderOrchestration/requestIntake'
export type { RequestIntakeDependencies } from '../dataSource/renderOrchestration/requestIntake'

export { generateRoomPreview, defaultPublishPutCacheRecord } from '../dataSource/renderOrchestration/generateRoomPreview'
export type {
    GenerateRoomPreviewGenerationReturn,
    GenerateRoomPreviewInput,
    GenerateRoomPreviewOptions,
} from '../dataSource/renderOrchestration/generateRoomPreview'

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
} from '../dataSource/renderOrchestration/baseClasses'

export {
    isRenderResolveInputSuccess,
    RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
} from '../dataSource/renderOrchestration/baseClasses'

export { deliverIntakeErrorsIfAny } from '../dataSource/renderOrchestration/intakeErrors'

export { findRender } from '../dataSource/renderOrchestration/findRender'
export type { FindRenderDependencies } from '../dataSource/renderOrchestration/findRender'

export { RENDER_ERROR_CODE_NOT_ROOM } from '../conversations/conversationTypes/roomStateRender/baseClasses'
