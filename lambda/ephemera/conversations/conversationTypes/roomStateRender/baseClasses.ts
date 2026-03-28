import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

import type { ConversationId, ConversationPayloadStub } from '../baseClasses'

/**
 * Serializable routing for passive / Meta-aligned room render (renderOrchestration passive shell).
 * Aligns with {@link RenderResolveInput.roomId} and perspective keying.
 */
export type RoomStateRenderConversationRouting = {
    roomId: EphemeraRoomId;
    perspectiveId: string;
    requestId?: string;
};

export const CONVERSATION_TYPE_ROOM_STATE_RENDER = 'roomStateRender' as const;

/** Storable (JSON-safe) row for the roomStateRender conversation path. */
export type StorableConversationRecordRoomStateRender = {
    conversationId: ConversationId;
    type: typeof CONVERSATION_TYPE_ROOM_STATE_RENDER;
    routing: RoomStateRenderConversationRouting;
    payload: ConversationPayloadStub;
};

/**
 * Non-terminal frames: cache/pointer work vs LLM generation (when wired), mirroring preview `generating`.
 */
export type RoomStateRenderProgressStep = 'resolving' | 'generating';

/**
 * Live handle: same progressive + terminal contract as the shared resolve core ({@link RenderResolveOutput}).
 */
export type ConversationHandleRoomStateRender = StorableConversationRecordRoomStateRender & {
    /**
     * - Progress: intake/cache phases (`resolving`) and generation (`generating`) before terminal resolve.
     * - Terminal: {@link RenderResolveOutput} from passive orchestration / shared resolve core.
     */
    sendMessage: (arg: RoomStateRenderProgressStep | RenderResolveOutput) => Promise<void>;
};
