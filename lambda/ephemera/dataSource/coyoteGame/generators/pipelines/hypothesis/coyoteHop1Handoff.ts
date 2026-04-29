import { findAllFenceBlocks } from '../../../../../llm/markdownCodeFences'
import { hypothesisDebugLog } from '../../../utilities/hypothesisDebug'

/** Canonical JSON keys for hop-1 handoff (plan selection to phase-plan). */
export const COYOTE_HOP1_HANDOFF_JSON_KEYS = {
    paragraphSummary: 'paragraphSummary',
    planIssues: 'planIssues',
} as const

export type CoyoteHop1Handoff = {
    paragraphSummary: string
    planIssues: PlanIssue[]
}

export type PlanIssueIntentSignalCode =
    | 'OUTLIER_PROP_UNACCOUNTED'
    | 'TROPE_FUNCTION_MISMATCH'
    | 'STRUCTURAL_CONTRADICTION'

export type PlanIssueUnderspecificationCode =
    | 'DIRECTION_AMBIGUOUS'
    | 'ROLE_CONFLICT'

export type PlanIssueCode = PlanIssueIntentSignalCode | PlanIssueUnderspecificationCode

export type PlanIssue = {
    code: PlanIssueCode
    summary: string
    evidence?: string[]
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
    COYOTE_HOP1_HANDOFF_JSON_KEYS.planIssues,
])

const PLAN_ISSUE_INTENT_SIGNAL_CODES = new Set<PlanIssueIntentSignalCode>([
    'OUTLIER_PROP_UNACCOUNTED',
    'TROPE_FUNCTION_MISMATCH',
    'STRUCTURAL_CONTRADICTION',
])

const PLAN_ISSUE_UNDERSPECIFICATION_CODES = new Set<PlanIssueUnderspecificationCode>([
    'DIRECTION_AMBIGUOUS',
    'ROLE_CONFLICT',
])

export function isIntentSignalPlanIssueCode(code: unknown): code is PlanIssueIntentSignalCode {
    return typeof code === 'string' && PLAN_ISSUE_INTENT_SIGNAL_CODES.has(code as PlanIssueIntentSignalCode)
}

export function isUnderspecificationPlanIssueCode(
    code: unknown
): code is PlanIssueUnderspecificationCode {
    return (
        typeof code === 'string'
        && PLAN_ISSUE_UNDERSPECIFICATION_CODES.has(code as PlanIssueUnderspecificationCode)
    )
}

function isPlanIssueCode(code: unknown): code is PlanIssueCode {
    return isIntentSignalPlanIssueCode(code) || isUnderspecificationPlanIssueCode(code)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validatePlanIssueRow(row: unknown, rowIndex: number): ParseHop1HandoffResult | null {
    if (!isPlainObject(row)) {
        return { ok: false, reason: `planIssues[${rowIndex}] must be a plain object` }
    }
    if (!('code' in row)) {
        return { ok: false, reason: `planIssues[${rowIndex}] missing required key: code` }
    }
    if (!isPlanIssueCode(row.code)) {
        return {
            ok: false,
            reason: `planIssues[${rowIndex}] code must be one of OUTLIER_PROP_UNACCOUNTED, TROPE_FUNCTION_MISMATCH, STRUCTURAL_CONTRADICTION, DIRECTION_AMBIGUOUS, ROLE_CONFLICT`,
        }
    }
    if (!('summary' in row)) {
        return { ok: false, reason: `planIssues[${rowIndex}] missing required key: summary` }
    }
    if (typeof row.summary !== 'string') {
        return { ok: false, reason: `planIssues[${rowIndex}] summary must be a string` }
    }
    if ('evidence' in row) {
        if (!Array.isArray(row.evidence)) {
            return { ok: false, reason: `planIssues[${rowIndex}] evidence must be an array of strings when present` }
        }
        if (!row.evidence.every((item): item is string => typeof item === 'string')) {
            return { ok: false, reason: `planIssues[${rowIndex}] evidence must be an array of strings when present` }
        }
    }
    return null
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
    const planIssues = parsed.planIssues
    if (typeof paragraphSummary !== 'string') {
        return { ok: false, reason: 'paragraphSummary must be a string' }
    }
    if (!Array.isArray(planIssues)) {
        return { ok: false, reason: 'planIssues must be an array' }
    }
    const narrowedPlanIssues: PlanIssue[] = []
    for (let i = 0; i < planIssues.length; i += 1) {
        const validationFailure = validatePlanIssueRow(planIssues[i], i)
        if (validationFailure) {
            return validationFailure
        }
        const row = planIssues[i] as PlanIssue
        narrowedPlanIssues.push({
            code: row.code,
            summary: row.summary,
            evidence: row.evidence,
        })
    }
    return {
        ok: true,
        handoff: { paragraphSummary, planIssues: narrowedPlanIssues },
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
        planIssueCount: narrowed.handoff.planIssues.length,
    })
    return narrowed
}
