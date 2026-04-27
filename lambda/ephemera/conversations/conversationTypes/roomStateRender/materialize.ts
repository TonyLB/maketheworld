import { isRenderProgress, type RenderResolveOutput } from '../../../dataSource/renderOrchestration/baseClasses'
import {
    toRenderError,
    toRenderInvalidate,
    toRenderReady,
} from '../../../dataSource/renderOrchestration/events'
import type { RenderError, RenderInvalidate, RenderReady, RenderRequested } from '../../../messageBus/baseClasses'
import type { MessageBus } from '../../../messageBus/baseClasses'

import type { ConversationHandleRoomStateRender, StorableConversationRecordRoomStateRender } from './baseClasses'

export type MaterializeRoomStateRenderDeps = {
    messageBus: MessageBus;
};

/**
 * Live handle: progress steps are reserved for future streaming; terminal {@link RenderResolveOutput}
 * is mapped in {@link enrichRenderResolveForPassive} and sent on `messageBus` when
 * `record.routing.passiveBusDelivery` is set.
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

/**
 * Passive / state-driven: map {@link RenderResolveOutput} plus {@link RenderRequested} correlation
 * to a `messageBus` payload (`RenderReady`, `RenderInvalidate`, or `RenderError`), or `undefined` when
 * nothing should be sent. Inlined here (same role as preview materialize's identity enrich step before wire mapping).
 */
function enrichRenderResolveForPassive(
    payload: RenderRequested,
    output: RenderResolveOutput
): RenderReady | RenderInvalidate | RenderError | undefined {
    if (output.type === 'resolved') {
        const { cacheId, cacheRecord } = output
        if (cacheId === undefined || cacheRecord === undefined) {
            console.error('enrichRenderResolveForPassive: resolved outcome missing cacheId or cacheRecord')
            return undefined
        }
        return toRenderReady(payload, cacheId, cacheRecord)
    }
    if (output.type === 'invalidate') {
        return toRenderInvalidate(payload, output.reason)
    }
    if (output.type === 'failed') {
        return toRenderError(payload, output.errorCode, output.errorMessage)
    }
    const _exhaustive: never = output
    return _exhaustive
}
