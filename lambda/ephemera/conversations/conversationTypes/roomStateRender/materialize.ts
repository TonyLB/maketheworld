import { isRenderProgress, type RenderResolveOutput } from '../../../renderOrchestration/baseClasses'
import { enrichRenderResolveForPassive } from './enrichRenderResolveForPassive'
import type { RenderRequested } from '../../../renderOrchestration/events'
import type { MessageBus } from '../../../messageBus/baseClasses'

import type { ConversationHandleRoomStateRender, StorableConversationRecordRoomStateRender } from './baseClasses'

export type MaterializeRoomStateRenderDeps = {
    messageBus: MessageBus;
};

/**
 * Live handle: progress steps are reserved for future streaming; terminal {@link RenderResolveOutput}
 * is published on `messageBus` via {@link enrichRenderResolveForPassive} (return value) plus
 * `messageBus.send` when `record.routing.passiveBusDelivery` is set.
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
        const message = enrichRenderResolveForPassive(payload, arg)
        if (message !== undefined) {
            deps.messageBus.send(message)
        }
    }

    return {
        ...record,
        sendMessage,
    };
}
