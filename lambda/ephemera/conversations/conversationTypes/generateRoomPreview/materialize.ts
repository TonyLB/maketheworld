import type { MessageBus } from '../../../messageBus/baseClasses'

import type {
    ConversationHandleGenerateRoomPreview,
    StorableConversationRecordGenerateRoomPreview,
} from './baseClasses'

export type MaterializeGenerateRoomPreviewDeps = {
    messageBus: MessageBus
}

export function materializeGenerateRoomPreview(
    record: StorableConversationRecordGenerateRoomPreview,
    deps: MaterializeGenerateRoomPreviewDeps
): ConversationHandleGenerateRoomPreview {
    const sendMessage: ConversationHandleGenerateRoomPreview['sendMessage'] = (result) => {
        deps.messageBus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'GenerateRoomPreview',
                generateRoomPreview: result,
                ...(record.routing.requestId !== undefined ? { RequestId: record.routing.requestId } : {}),
            },
        })
    }
    return {
        ...record,
        sendMessage,
    }
}
