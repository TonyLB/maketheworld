import {
    isRenderResolveInputError,
    type RenderResolveInput,
} from './baseClasses'

/** Payload for {@link Orchestration Error} when passive intake fails before {@link findRender}. */
export type IntakeOrchestrationError = {
    errorCode: string;
    errorMessage: string;
}

/**
 * If passive {@link RenderResolveInput} is an intake error, returns fields for a single
 * {@link Orchestration Error} stream publish. Otherwise `null`.
 */
export const getIntakeOrchestrationErrorIfAny = (
    intake: RenderResolveInput
): IntakeOrchestrationError | null => {
    if (!isRenderResolveInputError(intake)) {
        return null
    }
    switch (intake.errorCode) {
        case 'RENDER_REQUESTED_NOT_ROOM':
            return {
                errorCode: 'NOT_ROOM',
                errorMessage: intake.errorMessage,
            }
        case 'META_ROOM_MARKS_MISSING':
            return {
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: intake.errorMessage,
            }
        default:
            return null
    }
}
