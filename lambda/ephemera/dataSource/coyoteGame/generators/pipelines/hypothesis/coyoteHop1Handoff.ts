import { findAllFenceBlocks } from '../../../../../llm/markdownCodeFences'
import { hypothesisDebugLog } from '../../../utilities/hypothesisDebug'

/** Canonical JSON keys for hop-1 handoff (plan selection to phase-plan). */
export const COYOTE_HOP1_HANDOFF_JSON_KEYS = {
    paragraphSummary: 'paragraphSummary',
    rubricIssues: 'rubricIssues',
} as const

export type CoyoteHop1Handoff = {
    paragraphSummary: string
    rubricIssues: string[]
}

export type ParseHop1HandoffResult =
    | { ok: true; handoff: CoyoteHop1Handoff }
    | { ok: false; reason: string }

const REQUIRED_SECTION_HEADINGS = [
    '## Intent conflicts',
    '## Rubric comparison',
    '## Winner selection',
] as const

const REQUIRED_KEYS = new Set<string>([
    COYOTE_HOP1_HANDOFF_JSON_KEYS.paragraphSummary,
    COYOTE_HOP1_HANDOFF_JSON_KEYS.rubricIssues,
])

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function narrowHandoff(parsed: unknown): ParseHop1HandoffResult {
    if (!isPlainObject(parsed)) {
        return { ok: false, reason: 'handoff JSON must be a plain object' }
    }
    for (const req of REQUIRED_KEYS) {
        if (!(req in parsed)) {
            return { ok: false, reason: `missing key in handoff JSON: ${req}` }
        }
    }
    const paragraphSummary = parsed.paragraphSummary
    const rubricIssues = parsed.rubricIssues
    if (typeof paragraphSummary !== 'string') {
        return { ok: false, reason: 'paragraphSummary must be a string' }
    }
    if (!Array.isArray(rubricIssues)) {
        return { ok: false, reason: 'rubricIssues must be an array' }
    }
    if (!rubricIssues.every((item): item is string => typeof item === 'string')) {
        return { ok: false, reason: 'rubricIssues must be an array of strings' }
    }
    return {
        ok: true,
        handoff: { paragraphSummary, rubricIssues },
    }
}

function containsRequiredSections(raw: string): { ok: false; reason: string } | null {
    for (const heading of REQUIRED_SECTION_HEADINGS) {
        if (!raw.includes(heading)) {
            return { ok: false, reason: `missing required section heading: ${heading}` }
        }
    }
    return null
}

/**
 * Parses hop-1 plan-selection assistant output for the trailing **` ```json `** handoff block.
 * Uses the **last** fence whose language tag is **`json`** (case-insensitive).
 */
export function parseHop1HandoffFromSelectionBody(raw: string): ParseHop1HandoffResult {
    const requiredSectionsResult = containsRequiredSections(raw)
    if (requiredSectionsResult) {
        hypothesisDebugLog('hop1 handoff parse failed', { reason: requiredSectionsResult.reason })
        return requiredSectionsResult
    }
    const blocks = findAllFenceBlocks(raw)
    hypothesisDebugLog('hop1 handoff parse: scanned fenced blocks', {
        blockCount: blocks.length,
        blockLangs: blocks.map((block) => block.lang),
    })
    let lastJsonInterior: string | null = null
    for (let b = blocks.length - 1; b >= 0; b--) {
        if (blocks[b].lang.toLowerCase() === 'json') {
            lastJsonInterior = blocks[b].interior
            break
        }
    }
    if (lastJsonInterior === null) {
        hypothesisDebugLog('hop1 handoff parse failed', { reason: 'no ```json fenced block found' })
        return { ok: false, reason: 'no ```json fenced block found' }
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(lastJsonInterior.trim()) as unknown
    } catch {
        hypothesisDebugLog('hop1 handoff parse failed', { reason: 'invalid JSON inside ```json fence' })
        return { ok: false, reason: 'invalid JSON inside ```json fence' }
    }
    const narrowed = narrowHandoff(parsed)
    if (!narrowed.ok) {
        hypothesisDebugLog('hop1 handoff parse failed', { reason: narrowed.reason })
        return narrowed
    }
    hypothesisDebugLog('hop1 handoff parse succeeded', {
        rubricIssueCount: narrowed.handoff.rubricIssues.length,
    })
    return narrowed
}
