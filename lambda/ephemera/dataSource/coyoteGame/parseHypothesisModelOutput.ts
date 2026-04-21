import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame'

const STUB_INTENT = 'Hypothesis: Stubbed'

const OPEN_FENCE = /^```(?:text)?\s*\n?/i
const CLOSE_FENCE = /\n?```\s*$/i

/** Matches the Stage Two "## Scene analysis" heading (prompt contract). */
const SCENE_ANALYSIS_HEADING = /^\s*##\s+Scene analysis\s*$/i

export type ParseHypothesisModelOutputOptions = {
    /** When true, the Bedrock response included a reasoning channel (informational; trim rules apply either way). */
    reasoningContentProvided?: boolean
}

function stripCodeFences(body: string): string {
    return body.trim().replace(OPEN_FENCE, '').replace(CLOSE_FENCE, '').trim()
}

function trimSceneAnalysisPrefix(preHypothesisLines: string[]): string {
    const headingIdx = preHypothesisLines.findIndex((line) => SCENE_ANALYSIS_HEADING.test(line))
    if (headingIdx < 0) {
        return preHypothesisLines.join('\n').trim()
    }
    return preHypothesisLines.slice(headingIdx).join('\n').trim()
}

/**
 * Splits Bedrock hypothesis output into scene analysis (optional) and a single Hypothesis: line.
 * Shared by generateHypothesis and the Coyote engine test harness.
 *
 * When "## Scene analysis" appears before the Hypothesis line, any lines **before** that heading are dropped
 * so leaked scratch text does not become player-visible scene analysis.
 */
export function parseHypothesisModelOutput(
    rawBody: string,
    _options?: ParseHypothesisModelOutputOptions
): CoyoteGameIntentRecord {
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
    const preHypothesis = lines.slice(0, hypothesisIndex)
    const sceneAnalysis = trimSceneAnalysisPrefix(preHypothesis)
    return sceneAnalysis.length > 0
        ? { intent, sceneAnalysis }
        : { intent }
}
