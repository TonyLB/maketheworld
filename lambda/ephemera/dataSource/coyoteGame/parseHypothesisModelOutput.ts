import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame'
import { findAllFenceBlocks } from '../../llm/markdownCodeFences'

const STUB_INTENT = 'Hypothesis: Stubbed'

const OPEN_FENCE = /^```(?:text)?\s*\n?/i
const CLOSE_FENCE = /\n?```\s*$/i

/** Matches the Stage Two "## Scene analysis" heading (prompt contract). */
const SCENE_ANALYSIS_HEADING = /^\s*##\s+Scene analysis\s*$/i

const HYPOTHESIS_LINE = /^\s*Hypothesis:\s*.+/u

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

function interiorIsSingleHypothesisLine(interior: string): string | null {
    const nonEmpty = interior
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    if (nonEmpty.length !== 1) {
        return null
    }
    return HYPOTHESIS_LINE.test(nonEmpty[0]) ? nonEmpty[0] : null
}

/**
 * New Stage Two contract: prefix (scene analysis Markdown) + final ``` fence whose interior is only Hypothesis: ...
 */
function trySplitFinalHypothesisFence(rawBody: string): { prefix: string; intentLine: string } | null {
    const blocks = findAllFenceBlocks(rawBody)
    for (let b = blocks.length - 1; b >= 0; b--) {
        const intentLine = interiorIsSingleHypothesisLine(blocks[b].interior)
        if (intentLine !== null) {
            return {
                prefix: rawBody.slice(0, blocks[b].start).trimEnd(),
                intentLine,
            }
        }
    }
    return null
}

/**
 * Splits Bedrock hypothesis output into scene analysis (optional) and a single Hypothesis: line.
 * Shared by generateHypothesis and the Coyote engine test harness.
 *
 * When "## Scene analysis" appears before the Hypothesis line, any lines **before** that heading are dropped
 * so leaked scratch text does not become player-visible scene analysis.
 *
 * **Final-fence path:** If the last fenced block whose interior is a single `Hypothesis:` line is present,
 * scene analysis is taken from the prefix before that fence (with the same `## Scene analysis` trim rules).
 * **Legacy path:** Otherwise, unwrap a single outer ``` fence if present, then use the first `Hypothesis:` line.
 */
export function parseHypothesisModelOutput(
    rawBody: string,
    _options?: ParseHypothesisModelOutputOptions
): CoyoteGameIntentRecord {
    const split = trySplitFinalHypothesisFence(rawBody)
    if (split) {
        const { prefix, intentLine } = split
        const intent = intentLine.trim()
        const preLines = prefix.split(/\r?\n/)
        const sceneAnalysis = trimSceneAnalysisPrefix(preLines)
        if (!prefix.trim()) {
            return { intent }
        }
        return sceneAnalysis.length > 0 ? { intent, sceneAnalysis } : { intent }
    }

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
    return sceneAnalysis.length > 0 ? { intent, sceneAnalysis } : { intent }
}
