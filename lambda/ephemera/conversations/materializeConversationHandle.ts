import type { MessageBus } from '../messageBus/baseClasses'
import {
    CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW,
    materializeGenerateRoomPreview,
    type StorableConversationRecord,
} from './conversationTypes/generateRoomPreview'
import type { ConversationHandle } from './conversationTypes/handle'

export type ConversationMaterializeDeps = {
    messageBus: MessageBus
}

export function materializeConversationHandle(
    record: StorableConversationRecord,
    deps: ConversationMaterializeDeps
): ConversationHandle {
    switch (record.type) {
        case CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW:
            return materializeGenerateRoomPreview(record, deps)
    }
}
