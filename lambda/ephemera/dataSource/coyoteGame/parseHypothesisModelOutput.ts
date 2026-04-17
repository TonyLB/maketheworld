import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame'

const STUB_INTENT = 'Hypothesis: Stubbed'

const OPEN_FENCE = /^```(?:text)?\s*\n?/i
const CLOSE_FENCE = /\n?```\s*$/i

function stripCodeFences(body: string): string {
    return body.trim().replace(OPEN_FENCE, '').replace(CLOSE_FENCE, '').trim()
}

/**
 * Splits Bedrock hypothesis output into scene analysis (optional) and a single Hypothesis: line.
 * Shared by generateHypothesis and the Coyote engine test harness.
 */
export function parseHypothesisModelOutput(rawBody: string): CoyoteGameIntentRecord {
    const unwrapped = stripCodeFences(rawBody)
    if (!unwrapped) {
        return { intent: STUB_INTENT }
    }
    const lines = unwrapped.split(/\r?\n/)
    const hypothesisIndex = lines.findIndex((line) => /^\s*Hypothesis:\s*.+/u.test(line))
    if (hypothesisIndex < 0) {
        return { intent: unwrapped }
    }
    const intent = lines[hypothesisIndex].trim()
    const sceneAnalysis = lines.slice(0, hypothesisIndex).join('\n').trim()
    return sceneAnalysis.length > 0
        ? { intent, sceneAnalysis }
        : { intent }
}
