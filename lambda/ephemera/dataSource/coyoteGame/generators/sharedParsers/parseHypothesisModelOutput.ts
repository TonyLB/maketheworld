import type { CoyotePhasePlanValidationContext } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import { validateCoyotePhasePlan } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import type { CoyoteGameIntentRecord } from '../../../../internalCache/coyoteGame'
import { findAllFenceBlocks } from '../../../../llm/markdownCodeFences'

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
/** Removes every **` ```json ` ** fenced region (Option A hop-2 phase-plan JSON) so prose parsing sees only scene analysis + Hypothesis fences. */
function stripAllJsonFences(rawBody: string): string {
    let s = rawBody
    const blocks = findAllFenceBlocks(s)
    const jsonBlocks = blocks
        .filter((b) => b.lang.toLowerCase() === 'json')
        .sort((a, b) => b.start - a.start)
    for (const b of jsonBlocks) {
        s = s.slice(0, b.start) + s.slice(b.end)
    }
    return s.trim()
}

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
export type ParseHypothesisPhasePlanHopResult = {
    record: CoyoteGameIntentRecord
    /** Raw **` ```json ` ** interior that validated, when any. */
    phasePlanJson?: string
    phasePlanValidationReason?: string
}

/**
 * Option A hop 2: extracts **`phasePlan`** from **` ```json ` ** fences via [**`validateCoyotePhasePlan`**], then prose via [**`parseHypothesisModelOutput`**].
 * On validation failure, **`record`** still carries usable **`intent`** / **`walkthrough`** when prose parses (**Decided: structured validation failure**).
 */
export function parseHypothesisPhasePlanHopOutput(
    rawBody: string,
    phasePlanCtx: CoyotePhasePlanValidationContext,
    parseOptions?: ParseHypothesisModelOutputOptions
): ParseHypothesisPhasePlanHopResult {
    const blocks = findAllFenceBlocks(rawBody)
    let phasePlanJson: string | undefined
    let lastReason = 'no valid phase-plan JSON in ```json fences'

    for (const b of blocks) {
        if (b.lang.toLowerCase() !== 'json') {
            continue
        }
        const interior = b.interior.trim()
        let parsed: unknown
        try {
            parsed = JSON.parse(interior) as unknown
        } catch {
            lastReason = 'invalid JSON inside ```json fence'
            continue
        }
        const v = validateCoyotePhasePlan(parsed, phasePlanCtx)
        if (v.ok) {
            phasePlanJson = interior
            const proseBody = stripAllJsonFences(rawBody)
            const base = parseHypothesisModelOutput(proseBody, parseOptions)
            const record: CoyoteGameIntentRecord = {
                intent: base.intent,
                ...(base.walkthrough !== undefined ? { walkthrough: base.walkthrough } : {}),
                phasePlan: v.phasePlan,
            }
            return { record, phasePlanJson }
        }
        lastReason = v.reason
    }

    const proseBody = stripAllJsonFences(rawBody)
    const base = parseHypothesisModelOutput(proseBody, parseOptions)
    const record: CoyoteGameIntentRecord = {
        intent: base.intent,
        ...(base.walkthrough !== undefined ? { walkthrough: base.walkthrough } : {}),
    }

    return {
        record,
        phasePlanJson,
        phasePlanValidationReason: lastReason,
    }
}

export function parseHypothesisModelOutput(
    rawBody: string,
    _options?: ParseHypothesisModelOutputOptions
): CoyoteGameIntentRecord {
    const split = trySplitFinalHypothesisFence(rawBody)
    if (split) {
        const { prefix, intentLine } = split
        const intent = intentLine.trim()
        const preLines = prefix.split(/\r?\n/)
        const walkthrough = trimSceneAnalysisPrefix(preLines)
        if (!prefix.trim()) {
            return { intent }
        }
        return walkthrough.length > 0 ? { intent, walkthrough } : { intent }
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
    const walkthrough = trimSceneAnalysisPrefix(preHypothesis)
    return walkthrough.length > 0 ? { intent, walkthrough } : { intent }
}
