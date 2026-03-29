import { isRenderProgress, type RenderResolveOutput } from '../../../renderOrchestration/baseClasses'
import { deliverRenderResolveForPassive } from './deliverRenderResolveForPassive'
import type { RenderRequested } from '../../../renderOrchestration/events'
import type { MessageBus } from '../../../messageBus/baseClasses'

import type { ConversationHandleRoomStateRender, StorableConversationRecordRoomStateRender } from './baseClasses'

export type MaterializeRoomStateRenderDeps = {
    messageBus: MessageBus;
};

/**
 * Live handle: progress steps are reserved for future streaming; terminal {@link RenderResolveOutput}
 * is published on `messageBus` using the same mapping as {@link deliverRenderResolveForPassive}
 * when `record.routing.passiveBusDelivery` is set.
 */
export function materializeRoomStateRender(
    record: StorableConversationRecordRoomStateRender,
    deps: MaterializeRoomStateRenderDeps
): ConversationHandleRoomStateRender {
    const sendMessage: ConversationHandleRoomStateRender['sendMessage'] = async (arg) => {
        if (isRenderProgress(arg)) {
            return
        }
        const fields = record.routing.passiveBusDelivery
        if (fields === undefined) {
            console.error('materializeRoomStateRender: terminal sendMessage without routing.passiveBusDelivery on record')
            return
        }
        const payload: RenderRequested = {
            type: 'RenderRequested',
            componentId: record.routing.componentId,
            ...fields,
        }
        deliverRenderResolveForPassive(payload, deps.messageBus, arg)
    }

    return {
        ...record,
        sendMessage,
    };
}
