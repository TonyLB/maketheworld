import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../../../renderCache/baseClasses'
import type { RenderProgress, RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

import type { ConversationId, ConversationPayloadStub } from '../baseClasses'

/**
 * Serializable routing for GenerateRoomPreview (API / direct preview path).
 * Aligns with registration-time fields described in AGENT.planning.md.
 */
export type GenerateRoomPreviewConversationRouting = {
    roomId: EphemeraRoomId
    perspectiveId: string
    requestId?: string
}

/**
 * First union member: full-record discriminant; `routing` and `payload` narrow together.
 * Additional `type` variants and `payload` shapes: task list section 5 (second-pass typing).
 */
export const CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW = 'generateRoomPreview' as const

/** Storable (JSON-safe) row for the generateRoomPreview conversation path. */
export type StorableConversationRecordGenerateRoomPreview = {
    conversationId: ConversationId
    type: typeof CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW
    routing: GenerateRoomPreviewConversationRouting
    payload: ConversationPayloadStub
}

/** API / wire result for GenerateRoomPreview (orchestration implements this contract). */
export type GenerateRoomPreviewSuccess = {
    success: true
    renderedContent: EphemeraCacheRenderedContent
    /** Row key for the render-cache write (minted before `Put Cache Record` is enqueued; matches Dynamo `DataCategory`). */
    cacheId: EphemeraCacheId
    /** Materialized row matching what `putCacheRecord` persists for that `cacheId`. */
    cacheRecord: EphemeraCacheDynamoItem
}

export type GenerateRoomPreviewFailure =
    | { success: false; errorCode: 'NO_EXACT_MATCH'; errorMessage: string }
    | { success: false; errorCode: 'NOT_ROOM'; errorMessage: string }
    | { success: false; errorCode: 'CONTEXT_REQUIRED'; errorMessage: string }
    | { success: false; errorCode: 'GENERATION_FAILED'; errorMessage: string }

export type GenerateRoomPreviewResult = GenerateRoomPreviewSuccess | GenerateRoomPreviewFailure

/**
 * Live handle: storable fields plus `sendMessage` (not persisted).
 * Terminals match the shared resolve core ({@link RenderResolveOutput}), aligned with `roomStateRender`.
 */
export type ConversationHandleGenerateRoomPreview = StorableConversationRecordGenerateRoomPreview & {
    /**
     * - Progress: {@link RenderProgress} (`generating` on wire today; `resolving` no-op until supported).
     * - Terminal: {@link RenderResolveOutput} from `findRender` / orchestration.
     *
     * `materialize` maps terminals to `ConversationStep` / `generateRoomPreview` wire via {@link GenerateRoomPreviewResult} body shape.
     */
    sendMessage: (arg: RenderProgress | RenderResolveOutput) => Promise<void>
}
