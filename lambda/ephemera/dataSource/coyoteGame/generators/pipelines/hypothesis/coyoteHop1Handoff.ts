import { findAllFenceBlocks } from '../../../../../llm/markdownCodeFences'
import { hypothesisDebugLog } from '../../../utilities/hypothesisDebug'

/** Canonical JSON keys for hop-1 handoff (Option A plan selection to hop 2). */
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
    const keys = Object.keys(parsed)
    const keySet = new Set(keys)
    if (keySet.size !== REQUIRED_KEYS.size) {
        return { ok: false, reason: 'handoff JSON must contain exactly paragraphSummary and rubricIssues' }
    }
    for (const k of keys) {
        if (!REQUIRED_KEYS.has(k)) {
            return { ok: false, reason: `unexpected key in handoff JSON: ${k}` }
        }
    }
    for (const req of REQUIRED_KEYS) {
        if (!keySet.has(req)) {
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

/**
 * Parses hop-1 plan-selection assistant output for the trailing **` ```json `** handoff block.
 * Uses the **last** fence whose language tag is **`json`** (case-insensitive).
 */
export function parseHop1HandoffFromSelectionBody(raw: string): ParseHop1HandoffResult {
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
