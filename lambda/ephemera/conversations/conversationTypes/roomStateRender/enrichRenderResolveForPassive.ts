import {
    toRenderError,
    toRenderInvalidate,
    toRenderReady,
    type RenderError,
    type RenderInvalidate,
    type RenderReady,
    type RenderRequested,
} from '../../../renderOrchestration/events'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

/** Passive {@link RenderRequested} is not a room id; Meta/cache resolve does not apply. */
export const RENDER_ERROR_CODE_NOT_ROOM = 'RENDER_REQUESTED_NOT_ROOM'

/**
 * Passive / state-driven path: map {@link RenderResolveOutput} plus {@link RenderRequested} correlation
 * to a `messageBus` payload (`RenderReady`, `RenderInvalidate`, or `RenderError`), or `undefined` when
 * nothing should be sent (e.g. invalid resolved shape). Callers invoke `messageBus.send` with the result.
 */
export const enrichRenderResolveForPassive = (
    payload: RenderRequested,
    output: RenderResolveOutput
): RenderReady | RenderInvalidate | RenderError | undefined => {
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
