import type { RenderProgress, RenderResolveOutput } from '../../../dataSource/renderOrchestration/baseClasses'
import type { RenderComponentId, RenderRequestedBusDeliveryFields } from '../../../messageBus/baseClasses'

/** Rest of {@link RenderRequestedBusDeliveryFields} when `componentId` lives on {@link RoomStateRenderConversationRouting}. */
export type RoomStateRenderPassiveBusDeliveryFields = Omit<RenderRequestedBusDeliveryFields, 'componentId'>

import type { ConversationId, ConversationPayloadStub } from '../baseClasses'

/** Passive {@link RenderRequested} is not a room id; Meta/cache resolve does not apply. */
export const RENDER_ERROR_CODE_NOT_ROOM = 'RENDER_REQUESTED_NOT_ROOM'

/**
 * Serializable routing for passive / Meta-aligned room render (renderOrchestration passive shell).
 * Aligns with {@link RenderComponentPerspective.componentId} (room, feature, or map) and perspective keying.
 */
export type RoomStateRenderConversationRouting = {
    componentId: RenderComponentId;
    perspectiveId: string;
    requestId?: string;
    /**
     * When set by passive orchestration, materialized `sendMessage` maps terminal
     * `RenderResolveOutput` to the render orchestration message bus (see `materializeRoomStateRender`).
     * `componentId` is {@link RoomStateRenderConversationRouting.componentId} above, not repeated here.
     */
    passiveBusDelivery?: RoomStateRenderPassiveBusDeliveryFields;
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
 * Live handle: same progressive + terminal contract as the shared resolve core ({@link RenderResolveOutput}).
 */
export type ConversationHandleRoomStateRender = StorableConversationRecordRoomStateRender & {
    /**
     * - Progress: {@link RenderProgress} (intake/cache vs generation) before terminal resolve.
     * - Terminal: {@link RenderResolveOutput} from passive orchestration / shared resolve core.
     */
    sendMessage: (arg: RenderProgress | RenderResolveOutput) => Promise<void>;
};
