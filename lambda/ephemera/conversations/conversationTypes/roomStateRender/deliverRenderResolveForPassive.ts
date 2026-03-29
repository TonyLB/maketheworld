import type { MessageBus } from '../../../messageBus/baseClasses'
import {
    toRenderError,
    toRenderInvalidate,
    toRenderReady,
    type RenderRequested,
} from '../../../renderOrchestration/events'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

/** Passive {@link RenderRequested} is not a room id; Meta/cache resolve does not apply. */
export const RENDER_ERROR_CODE_NOT_ROOM = 'RENDER_REQUESTED_NOT_ROOM'

/**
 * Passive / state-driven path: map {@link RenderResolveOutput} to `messageBus` envelopes (`RenderReady`, `RenderInvalidate`, `RenderError`).
 */
export const deliverRenderResolveForPassive = (
    payload: RenderRequested,
    messageBus: MessageBus,
    output: RenderResolveOutput
): void => {
    if (output.type === 'resolved') {
        const { cacheId, cacheRecord } = output
        if (cacheId === undefined || cacheRecord === undefined) {
            console.error('deliverRenderResolveForPassive: resolved outcome missing cacheId or cacheRecord')
            return
        }
        messageBus.send(toRenderReady(payload, cacheId, cacheRecord))
        return
    }
    if (output.type === 'invalidate') {
        messageBus.send(toRenderInvalidate(payload, output.reason))
        return
    }
    if (output.type === 'failed') {
        messageBus.send(toRenderError(payload, output.errorCode, output.errorMessage))
    }
}
