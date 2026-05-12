import { findAllFenceBlocks } from '../../../../../../llm/markdownCodeFences'
import type { AffordanceProvidedRef, CoyoteTrope, EnvironmentAffordanceRef } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    isAffordanceProvidedRef,
    isCoyoteTrope,
    isEnvironmentAffordanceRef,
    isSyntaxMaterializedAffordanceStableKey,
    MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { CANONICAL_TROPE_ORDER } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import { truncateCoyoteGimmickEcho } from '../candidates/parseCandidateOutput'
import { hypothesisDebugLog } from '../../../../utilities/hypothesisDebug'
import type {
    PlanSelectCombinedCandidate,
    PlanSelectCombinedMember,
    PlanSelectCombinedOutlier,
    PlanSelectCombinedTropeAssignment,
} from '../candidates/combineCandidateOutput'

/** Canonical trope ordering for deterministic narrowed-record emission. */
const TROPE_ORDER: CoyoteTrope[] = CANONICAL_TROPE_ORDER

/** Re-export for callers that import from this module; grammar lives in mtw-interfaces. */
export { MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX }

/**
 * True when `stableKey` (after trim) uses the materialization prefix and the suffix matches the handoff contract.
 * Staged keys that do not start with the prefix are valid and return true.
 */
export function isValidMaterializedAffordanceStableKey(stableKey: string): boolean {
    const trimmed = stableKey.trim()
    if (!trimmed.startsWith(MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX)) {
        return true
    }
    return isSyntaxMaterializedAffordanceStableKey(trimmed)
}

function materializedAffordanceStableKeyValidationFailureReason(stableKey: string): string | null {
    const trimmed = stableKey.trim()
    if (!trimmed.startsWith(MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX)) {
        return null
    }
    if (!isSyntaxMaterializedAffordanceStableKey(trimmed)) {
        const suffix = trimmed.slice(MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX.length)
        if (suffix.length === 0) {
            return 'materialized affordance stableKey must have a non-empty suffix after "affordance:"'
        }
        return 'materialized affordance stableKey suffix must contain only letters, digits, underscores, and hyphens'
    }
    return null
}

/** Canonical JSON keys for planSelect output (plan selection to phase-plan). */
export const PLAN_SELECT_OUTPUT_JSON_KEYS = {
    paragraphSummary: 'paragraphSummary',
    /** Model-facing handoff key; parser renames to {@link PLAN_SELECT_OUTPUT_JSON_KEYS.planIssues}. */
    remainingPlanIssues: 'remainingPlanIssues',
    planIssues: 'planIssues',
    selectedCandidate: 'selectedCandidate',
} as const

export type PlanSelectWinningCandidateMember = PlanSelectCombinedMember
export type PlanSelectWinningCandidateOutlier = PlanSelectCombinedOutlier
export type PlanSelectWinningCandidateTropeAssignment = PlanSelectCombinedTropeAssignment
export type PlanSelectWinningCandidate = PlanSelectCombinedCandidate

export type PlanSelectOutput = {
    paragraphSummary: string
    planIssues: PlanIssue[]
    selectedCandidate?: PlanSelectWinningCandidate
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

export type ParsePlanSelectOutputResult =
    | { ok: true; handoff: PlanSelectOutput }
    | { ok: false; reason: string }

type ParsePlanSelectOutputFailure = { ok: false; reason: string }

const REQUIRED_SECTION_HEADINGS = [
    'Intent conflicts',
    'Rubric comparison',
] as const


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

function validatePlanIssueRow(
    row: unknown,
    rowIndex: number,
    issuesKeyLabel: string
): ParsePlanSelectOutputFailure | null {
    if (!isPlainObject(row)) {
        return { ok: false, reason: `${issuesKeyLabel}[${rowIndex}] must be a plain object` }
    }
    if (!('code' in row)) {
        return { ok: false, reason: `${issuesKeyLabel}[${rowIndex}] missing required key: code` }
    }
    if (!isPlanIssueCode(row.code)) {
        return {
            ok: false,
            reason: `${issuesKeyLabel}[${rowIndex}] code must be one of OUTLIER_PROP_UNACCOUNTED, TROPE_FUNCTION_MISMATCH, STRUCTURAL_CONTRADICTION, DIRECTION_AMBIGUOUS, ROLE_CONFLICT`,
        }
    }
    if (!('summary' in row)) {
        return { ok: false, reason: `${issuesKeyLabel}[${rowIndex}] missing required key: summary` }
    }
    if (typeof row.summary !== 'string') {
        return { ok: false, reason: `${issuesKeyLabel}[${rowIndex}] summary must be a string` }
    }
    if ('evidence' in row) {
        if (!Array.isArray(row.evidence)) {
            return { ok: false, reason: `${issuesKeyLabel}[${rowIndex}] evidence must be an array of strings when present` }
        }
        if (!row.evidence.every((item): item is string => typeof item === 'string')) {
            return { ok: false, reason: `${issuesKeyLabel}[${rowIndex}] evidence must be an array of strings when present` }
        }
    }
    return null
}

/** Validates each `tropeAssignments.*.members[]` row; see `PlanSelectCombinedMember` and ../AGENT.md#materialized-affordance-rows-synthetic-stablekey */
function validatePlanSelectWinningCandidateMemberRow(
    row: unknown,
    reasonPath: string
): { ok: true; member: PlanSelectWinningCandidateMember } | ParsePlanSelectOutputFailure {
    if (!isPlainObject(row)) {
        return { ok: false, reason: `${reasonPath} must be a plain object` }
    }
    if (typeof row.stableKey !== 'string') {
        return { ok: false, reason: `${reasonPath}.stableKey must be a string` }
    }
    const stableKey = row.stableKey.trim()
    const materializedKeyError = materializedAffordanceStableKeyValidationFailureReason(stableKey)
    if (materializedKeyError !== null) {
        return { ok: false, reason: `${reasonPath}.stableKey ${materializedKeyError}` }
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
    let environmentAffordances: EnvironmentAffordanceRef[] | undefined
    if ('environmentAffordances' in row) {
        if (!Array.isArray(row.environmentAffordances)) {
            return { ok: false, reason: `${reasonPath}.environmentAffordances must be an array when present` }
        }
        const narrowed: EnvironmentAffordanceRef[] = []
        for (let i = 0; i < row.environmentAffordances.length; i += 1) {
            const entry = row.environmentAffordances[i]
            if (!isEnvironmentAffordanceRef(entry)) {
                return {
                    ok: false,
                    reason: `${reasonPath}.environmentAffordances[${i}] must be a valid environmentAffordances entry`,
                }
            }
            narrowed.push(entry)
        }
        environmentAffordances = narrowed.length > 0 ? narrowed : undefined
    }
    let affordancesProvided: AffordanceProvidedRef[] | undefined
    if ('affordancesProvided' in row) {
        if (!Array.isArray(row.affordancesProvided)) {
            return { ok: false, reason: `${reasonPath}.affordancesProvided must be an array when present` }
        }
        const narrowed: AffordanceProvidedRef[] = []
        for (let i = 0; i < row.affordancesProvided.length; i += 1) {
            const entry = row.affordancesProvided[i]
            if (!isAffordanceProvidedRef(entry)) {
                return {
                    ok: false,
                    reason: `${reasonPath}.affordancesProvided[${i}] must be a valid affordancesProvided entry`,
                }
            }
            narrowed.push(entry)
        }
        affordancesProvided = narrowed.length > 0 ? narrowed : undefined
    }
    return {
        ok: true,
        member: {
            stableKey,
            shortName: row.shortName,
            room: row.room,
            tropeFunction: row.tropeFunction,
            ...(environmentAffordances !== undefined ? { environmentAffordances } : {}),
            ...(affordancesProvided !== undefined ? { affordancesProvided } : {}),
        },
    }
}

function validatePlanSelectWinningCandidateOutlierRow(
    row: unknown,
    reasonPath: string
): { ok: true; outlier: PlanSelectWinningCandidateOutlier } | ParsePlanSelectOutputFailure {
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
    let environmentAffordances: EnvironmentAffordanceRef[] | undefined
    if ('environmentAffordances' in row) {
        if (!Array.isArray(row.environmentAffordances)) {
            return { ok: false, reason: `${reasonPath}.environmentAffordances must be an array when present` }
        }
        const narrowed: EnvironmentAffordanceRef[] = []
        for (let i = 0; i < row.environmentAffordances.length; i += 1) {
            const entry = row.environmentAffordances[i]
            if (!isEnvironmentAffordanceRef(entry)) {
                return {
                    ok: false,
                    reason: `${reasonPath}.environmentAffordances[${i}] must be a valid environmentAffordances entry`,
                }
            }
            narrowed.push(entry)
        }
        environmentAffordances = narrowed.length > 0 ? narrowed : undefined
    }
    let affordancesProvided: AffordanceProvidedRef[] | undefined
    if ('affordancesProvided' in row) {
        if (!Array.isArray(row.affordancesProvided)) {
            return { ok: false, reason: `${reasonPath}.affordancesProvided must be an array when present` }
        }
        const narrowed: AffordanceProvidedRef[] = []
        for (let i = 0; i < row.affordancesProvided.length; i += 1) {
            const entry = row.affordancesProvided[i]
            if (!isAffordanceProvidedRef(entry)) {
                return {
                    ok: false,
                    reason: `${reasonPath}.affordancesProvided[${i}] must be a valid affordancesProvided entry`,
                }
            }
            narrowed.push(entry)
        }
        affordancesProvided = narrowed.length > 0 ? narrowed : undefined
    }
    return {
        ok: true,
        outlier: {
            stableKey: row.stableKey,
            shortName: row.shortName,
            room: row.room,
            ...(environmentAffordances !== undefined ? { environmentAffordances } : {}),
            ...(affordancesProvided !== undefined ? { affordancesProvided } : {}),
        },
    }
}

function validatePlanSelectWinningCandidate(
    raw: unknown
): { ok: true; selectedCandidate: PlanSelectWinningCandidate } | ParsePlanSelectOutputFailure {
    if (!isPlainObject(raw)) {
        return { ok: false, reason: 'selectedCandidate must be a plain object' }
    }
    if (typeof raw.candidateId !== 'string') {
        return { ok: false, reason: 'selectedCandidate.candidateId must be a string' }
    }
    if (typeof raw.executionSummary !== 'string') {
        return { ok: false, reason: 'selectedCandidate.executionSummary must be a string' }
    }
    let gimmick: string | undefined
    if ('gimmick' in raw && raw.gimmick !== undefined) {
        if (typeof raw.gimmick !== 'string') {
            return { ok: false, reason: 'selectedCandidate.gimmick must be a string when present' }
        }
        gimmick = truncateCoyoteGimmickEcho(raw.gimmick)
    }
    const tropeAssignmentsRaw = raw.tropeAssignments
    if (Array.isArray(tropeAssignmentsRaw) || !isPlainObject(tropeAssignmentsRaw)) {
        return {
            ok: false,
            reason: 'selectedCandidate.tropeAssignments must be a non-array object keyed by trope',
        }
    }
    const tropeAssignmentsRecord: Partial<Record<CoyoteTrope, PlanSelectWinningCandidateTropeAssignment>> = {}
    for (const tropeKey of Object.keys(tropeAssignmentsRaw)) {
        if (!isCoyoteTrope(tropeKey)) {
            return {
                ok: false,
                reason: `selectedCandidate.tropeAssignments has invalid trope key "${tropeKey}"`,
            }
        }
        const tropeAssignment = tropeAssignmentsRaw[tropeKey]
        if (!isPlainObject(tropeAssignment)) {
            return {
                ok: false,
                reason: `selectedCandidate.tropeAssignments.${tropeKey} must be a plain object`,
            }
        }
        if (typeof tropeAssignment.executionDetail !== 'string') {
            return {
                ok: false,
                reason: `selectedCandidate.tropeAssignments.${tropeKey}.executionDetail must be a string`,
            }
        }
        if (!Array.isArray(tropeAssignment.members)) {
            return {
                ok: false,
                reason: `selectedCandidate.tropeAssignments.${tropeKey}.members must be an array`,
            }
        }
        const narrowedMembers: PlanSelectWinningCandidateMember[] = []
        for (let j = 0; j < tropeAssignment.members.length; j += 1) {
            const memberResult = validatePlanSelectWinningCandidateMemberRow(
                tropeAssignment.members[j],
                `selectedCandidate.tropeAssignments.${tropeKey}.members[${j}]`
            )
            if (!memberResult.ok) {
                return memberResult
            }
            narrowedMembers.push(memberResult.member)
        }
        tropeAssignmentsRecord[tropeKey] = {
            executionDetail: tropeAssignment.executionDetail,
            members: narrowedMembers,
        }
    }
    const narrowedTropeAssignments: Partial<Record<CoyoteTrope, PlanSelectWinningCandidateTropeAssignment>> = {}
    for (const trope of TROPE_ORDER) {
        const entry = tropeAssignmentsRecord[trope]
        if (entry !== undefined) {
            narrowedTropeAssignments[trope] = entry
        }
    }
    if (!Array.isArray(raw.outliers)) {
        return { ok: false, reason: 'selectedCandidate.outliers must be an array' }
    }
    const narrowedOutliers: PlanSelectWinningCandidateOutlier[] = []
    for (let i = 0; i < raw.outliers.length; i += 1) {
        const outlierResult = validatePlanSelectWinningCandidateOutlierRow(
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
            ...(gimmick !== undefined ? { gimmick } : {}),
            tropeAssignments: narrowedTropeAssignments,
            outliers: narrowedOutliers,
        },
    }
}

function narrowHandoff(parsed: unknown): ParsePlanSelectOutputResult {
    if (!isPlainObject(parsed)) {
        return { ok: false, reason: 'handoff JSON must be a plain object' }
    }
    const paragraphSummary = parsed.paragraphSummary
    const selectedCandidateRaw = parsed.selectedCandidate
    if (typeof paragraphSummary !== 'string') {
        return { ok: false, reason: 'paragraphSummary must be a string' }
    }
    const remainingKey = PLAN_SELECT_OUTPUT_JSON_KEYS.remainingPlanIssues
    const legacyIssuesKey = PLAN_SELECT_OUTPUT_JSON_KEYS.planIssues
    const record = parsed as Record<string, unknown>
    const hasRemaining = remainingKey in record && record[remainingKey] !== undefined
    const issuesSourceKey = hasRemaining ? remainingKey : legacyIssuesKey
    const rawIssues = record[issuesSourceKey]
    if (rawIssues === undefined) {
        return {
            ok: false,
            reason: `missing key in handoff JSON: ${remainingKey} (or ${legacyIssuesKey} for legacy transcripts)`,
        }
    }
    if (!Array.isArray(rawIssues)) {
        return { ok: false, reason: `${issuesSourceKey} must be an array` }
    }
    const narrowedPlanIssues: PlanIssue[] = []
    for (let i = 0; i < rawIssues.length; i += 1) {
        const validationFailure = validatePlanIssueRow(rawIssues[i], i, issuesSourceKey)
        if (validationFailure) {
            return validationFailure
        }
        const row = rawIssues[i] as PlanIssue
        narrowedPlanIssues.push({
            code: row.code,
            summary: row.summary,
            evidence: row.evidence,
        })
    }
    let selectedCandidate: PlanSelectWinningCandidate | undefined
    if (selectedCandidateRaw !== undefined) {
        const selectedCandidateValidation = validatePlanSelectWinningCandidate(selectedCandidateRaw)
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
    hypothesisDebugLog('planSelect output parse failed', {
        reason,
        selectionBodyRaw: raw,
    })
}

/**
 * Parses planSelect assistant output for the trailing **` ```json `** handoff block.
 * Uses the **last** fence whose language tag is **`json`** (case-insensitive).
 *
 * The model emits **`remainingPlanIssues`** in the fence; this parser validates those rows and exposes them as
 * **`planIssues`** on {@link PlanSelectOutput} (legacy **`planIssues`** key in JSON still accepted as fallback).
 */
export function parsePlanSelectOutput(raw: string): ParsePlanSelectOutputResult {
    const missingSections = missingRequiredSections(raw)
    if (missingSections.length > 0) {
        hypothesisDebugLog('planSelect output parse warning: missing markdown sections (continuing with json handoff)', {
            missingSections,
        })
    }
    const blocks = findAllFenceBlocks(raw)
    hypothesisDebugLog('planSelect output parse: scanned fenced blocks', {
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
    hypothesisDebugLog('planSelect output parse succeeded', {
        planIssueCount: narrowed.handoff.planIssues.length,
    })
    return narrowed
}
