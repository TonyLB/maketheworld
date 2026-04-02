import {
    isRenderResolveInputError,
    type RenderResolveInput,
    type RenderResolveOutput,
} from '../dataSource/renderOrchestration/baseClasses'

/**
 * Maps passive {@link RenderResolveInput} intake errors to terminal {@link RenderResolveOutput}
 * `failed` shapes and delivers via the injected `sendMessage` (same contract as `findRender` deps).
 *
 * Preview uses the same helper for symmetry: with current preview intake (always success), this is a no-op.
 */
export const deliverIntakeErrorsIfAny = async (
    intake: RenderResolveInput,
    sendMessage: (output: RenderResolveOutput) => Promise<void>
): Promise<boolean> => {
    if (!isRenderResolveInputError(intake)) {
        return false
    }
    switch (intake.errorCode) {
        case 'RENDER_REQUESTED_NOT_ROOM':
            await sendMessage({
                type: 'failed',
                errorCode: 'NOT_ROOM',
                errorMessage: intake.errorMessage,
            })
            return true
        case 'META_ROOM_MARKS_MISSING':
            await sendMessage({
                type: 'failed',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: intake.errorMessage,
            })
            return true
    }
}
