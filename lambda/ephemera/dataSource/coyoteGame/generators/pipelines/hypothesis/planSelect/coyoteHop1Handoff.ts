import { findAllFenceBlocks } from '../../../../../../llm/markdownCodeFences'
import { isCoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { hypothesisDebugLog } from '../../../../utilities/hypothesisDebug'
import type {
    PlanSelectCombinedCandidate,
    PlanSelectCombinedMember,
    PlanSelectCombinedOutlier,
    PlanSelectCombinedTropeAssignment,
} from '../candidates/combineCandidateOutput'

/** Canonical JSON keys for hop-1 handoff (plan selection to phase-plan). */
export const COYOTE_HOP1_HANDOFF_JSON_KEYS = {
    paragraphSummary: 'paragraphSummary',
    planIssues: 'planIssues',
    selectedCandidate: 'selectedCandidate',
} as const

export type SelectedCandidateMember = PlanSelectCombinedMember
export type SelectedCandidateOutlier = PlanSelectCombinedOutlier
export type SelectedCandidateTropeAssignment = PlanSelectCombinedTropeAssignment
export type SelectedCandidate = PlanSelectCombinedCandidate

export type CoyoteHop1Handoff = {
    paragraphSummary: string
    planIssues: PlanIssue[]
    selectedCandidate?: SelectedCandidate
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

type ParseHop1HandoffFailure = { ok: false; reason: string }

const REQUIRED_SECTION_HEADINGS = [
    'Intent conflicts',
    'Rubric comparison',
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

function validatePlanIssueRow(row: unknown, rowIndex: number): ParseHop1HandoffFailure | null {
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

function validateSelectedCandidateMemberRow(
    row: unknown,
    reasonPath: string
): { ok: true; member: SelectedCandidateMember } | ParseHop1HandoffFailure {
    if (!isPlainObject(row)) {
        return { ok: false, reason: `${reasonPath} must be a plain object` }
    }
    if (typeof row.stableKey !== 'string') {
        return { ok: false, reason: `${reasonPath}.stableKey must be a string` }
    }
    if (typeof row.shortName !== 'string') {
        return { ok: false, reason: `${reasonPath}.shortName must be a string` }
    }
    if (typeof row.room !== 'string') {
        return { ok: false, reason: `${reasonPath}.room must be a string` }
    }
    if (typeof row.tropeFunction !== 'string') {
        return { ok: false, reason: `${reasonPath}.tropeFunction must be a string` }
    }
    return {
        ok: true,
        member: {
            stableKey: row.stableKey,
            shortName: row.shortName,
            room: row.room,
            tropeFunction: row.tropeFunction,
        },
    }
}

function validateSelectedCandidateOutlierRow(
    row: unknown,
    reasonPath: string
): { ok: true; outlier: SelectedCandidateOutlier } | ParseHop1HandoffFailure {
    if (!isPlainObject(row)) {
        return { ok: false, reason: `${reasonPath} must be a plain object` }
    }
    if (typeof row.stableKey !== 'string') {
        return { ok: false, reason: `${reasonPath}.stableKey must be a string` }
    }
    if (typeof row.shortName !== 'string') {
        return { ok: false, reason: `${reasonPath}.shortName must be a string` }
    }
    if (typeof row.room !== 'string') {
        return { ok: false, reason: `${reasonPath}.room must be a string` }
    }
    return {
        ok: true,
        outlier: {
            stableKey: row.stableKey,
            shortName: row.shortName,
            room: row.room,
        },
    }
}

function validateSelectedCandidate(
    raw: unknown
): { ok: true; selectedCandidate: SelectedCandidate } | ParseHop1HandoffFailure {
    if (!isPlainObject(raw)) {
        return { ok: false, reason: 'selectedCandidate must be a plain object' }
    }
    if (typeof raw.candidateId !== 'string') {
        return { ok: false, reason: 'selectedCandidate.candidateId must be a string' }
    }
    if (typeof raw.executionSummary !== 'string') {
        return { ok: false, reason: 'selectedCandidate.executionSummary must be a string' }
    }
    if (!Array.isArray(raw.tropeAssignments)) {
        return { ok: false, reason: 'selectedCandidate.tropeAssignments must be an array' }
    }
    const narrowedTropeAssignments: SelectedCandidateTropeAssignment[] = []
    for (let i = 0; i < raw.tropeAssignments.length; i += 1) {
        const tropeAssignment = raw.tropeAssignments[i]
        if (!isPlainObject(tropeAssignment)) {
            return { ok: false, reason: `selectedCandidate.tropeAssignments[${i}] must be a plain object` }
        }
        if (!isCoyoteTrope(tropeAssignment.trope)) {
            return { ok: false, reason: `selectedCandidate.tropeAssignments[${i}].trope must be a valid CoyoteTrope` }
        }
        if (typeof tropeAssignment.executionDetail !== 'string') {
            return { ok: false, reason: `selectedCandidate.tropeAssignments[${i}].executionDetail must be a string` }
        }
        if (!Array.isArray(tropeAssignment.members)) {
            return { ok: false, reason: `selectedCandidate.tropeAssignments[${i}].members must be an array` }
        }
        const narrowedMembers: SelectedCandidateMember[] = []
        for (let j = 0; j < tropeAssignment.members.length; j += 1) {
            const memberResult = validateSelectedCandidateMemberRow(
                tropeAssignment.members[j],
                `selectedCandidate.tropeAssignments[${i}].members[${j}]`
            )
            if (!memberResult.ok) {
                return memberResult
            }
            narrowedMembers.push(memberResult.member)
        }
        narrowedTropeAssignments.push({
            trope: tropeAssignment.trope,
            executionDetail: tropeAssignment.executionDetail,
            members: narrowedMembers,
        })
    }
    if (!Array.isArray(raw.outliers)) {
        return { ok: false, reason: 'selectedCandidate.outliers must be an array' }
    }
    const narrowedOutliers: SelectedCandidateOutlier[] = []
    for (let i = 0; i < raw.outliers.length; i += 1) {
        const outlierResult = validateSelectedCandidateOutlierRow(
            raw.outliers[i],
            `selectedCandidate.outliers[${i}]`
        )
        if (!outlierResult.ok) {
            return outlierResult
        }
        narrowedOutliers.push(outlierResult.outlier)
    }
    return {
        ok: true,
        selectedCandidate: {
            candidateId: raw.candidateId,
            executionSummary: raw.executionSummary,
            tropeAssignments: narrowedTropeAssignments,
            outliers: narrowedOutliers,
        },
    }
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
    const selectedCandidateRaw = parsed.selectedCandidate
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
    let selectedCandidate: SelectedCandidate | undefined
    if (selectedCandidateRaw !== undefined) {
        const selectedCandidateValidation = validateSelectedCandidate(selectedCandidateRaw)
        if (!selectedCandidateValidation.ok) {
            return selectedCandidateValidation
        }
        selectedCandidate = selectedCandidateValidation.selectedCandidate
    }
    return selectedCandidate
        ? {
            ok: true,
            handoff: { paragraphSummary, planIssues: narrowedPlanIssues, selectedCandidate },
        }
        : {
            ok: true,
            handoff: { paragraphSummary, planIssues: narrowedPlanIssues },
        }
}

function escapeRegexLiteral(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function missingRequiredSections(raw: string): string[] {
    const missing: string[] = []
    for (const heading of REQUIRED_SECTION_HEADINGS) {
        const headingPattern = new RegExp(`^\\s*#{2,3}\\s*${escapeRegexLiteral(heading)}\\s*$`, 'im')
        if (!headingPattern.test(raw)) {
            missing.push(`## ${heading}`)
        }
    }
    return missing
}

function logParseFailureWithRawBody(reason: string, raw: string): void {
    hypothesisDebugLog('hop1 handoff parse failed', {
        reason,
        selectionBodyRaw: raw,
    })
}

/**
 * Parses hop-1 plan-selection assistant output for the trailing **` ```json `** handoff block.
 * Uses the **last** fence whose language tag is **`json`** (case-insensitive).
 */
export function parseHop1HandoffFromSelectionBody(raw: string): ParseHop1HandoffResult {
    const missingSections = missingRequiredSections(raw)
    if (missingSections.length > 0) {
        hypothesisDebugLog('hop1 handoff parse warning: missing markdown sections (continuing with json handoff)', {
            missingSections,
        })
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
        logParseFailureWithRawBody('no ```json fenced block found', raw)
        return { ok: false, reason: 'no ```json fenced block found' }
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(lastJsonInterior.trim()) as unknown
    } catch {
        logParseFailureWithRawBody('invalid JSON inside ```json fence', raw)
        return { ok: false, reason: 'invalid JSON inside ```json fence' }
    }
    const narrowed = narrowHandoff(parsed)
    if (!narrowed.ok) {
        logParseFailureWithRawBody(narrowed.reason, raw)
        return narrowed
    }
    hypothesisDebugLog('hop1 handoff parse succeeded', {
        planIssueCount: narrowed.handoff.planIssues.length,
    })
    return narrowed
}
