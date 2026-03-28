import type { MessageBus } from '../../../messageBus/baseClasses'

import type {
    ConversationHandleRoomStateRender,
    StorableConversationRecordRoomStateRender,
} from './baseClasses'

export type MaterializeRoomStateRenderDeps = {
    messageBus: MessageBus;
};

/**
 * Returns a live handle whose `sendMessage` is currently a **no-op stub**.
 *
 * We do not route `roomStateRender` through `apiClient` / WebSocket `ConversationStep` frames. When passive
 * Passive render orchestration (`passiveRenderOrchestration`) is integrated with this pipeline, progressive messaging (progress steps and terminal
 * `RenderResolveOutput`-shaped delivery) should be implemented **here** or delegated from here
 * (e.g. message bus, shared orchestration), rather than copying `generateRoomPreview`'s client send path.
 */
export function materializeRoomStateRender(
    record: StorableConversationRecordRoomStateRender,
    deps: MaterializeRoomStateRenderDeps
): ConversationHandleRoomStateRender {
    void deps.messageBus;

    const sendMessage: ConversationHandleRoomStateRender['sendMessage'] = async (_arg) => {
        // Stub: no progressive or terminal side effects until orchestration wires delivery into this contract.
    };

    return {
        ...record,
        sendMessage,
    };
}
