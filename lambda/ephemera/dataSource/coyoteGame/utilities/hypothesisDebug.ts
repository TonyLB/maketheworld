export const COYOTE_HYPOTHESIS_DEBUG_ENABLED = true

const COYOTE_HYPOTHESIS_DEBUG_PREFIX = '[mtw.ephemera.coyoteGame.hypothesisDebug]'

export const hypothesisDebugLog = (message: string, details?: Record<string, unknown>): void => {
    if (!COYOTE_HYPOTHESIS_DEBUG_ENABLED) {
        return
    }
    if (details !== undefined) {
        console.log(COYOTE_HYPOTHESIS_DEBUG_PREFIX, message, details)
        return
    }
    console.log(COYOTE_HYPOTHESIS_DEBUG_PREFIX, message)
}
