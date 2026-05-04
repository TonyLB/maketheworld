import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    AffordanceProvidedRef,
    CoyoteTrope,
    EnvironmentAffordanceRef,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    isAffordanceProvidedRef,
    isCoyoteTrope,
    isEnvironmentAffordanceRef,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { CANONICAL_TROPE_ORDER } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'

/*
 * Stage 1 emits trope-first JSON: optional notes, required candidates[].
 * Each candidate includes tropeAssignments{} keyed by trope; optional outliers[] is scaffolding only (stableKey-only).
 * Trope members use stableKey + required tropeFunction. Authoritative outliers are derived in combine.
 */

/** One staged object reference under a trope assignment `members` row. */
export type ParsedCandidateMember = {
    stableKey: string
    tropeFunction: string
    environmentAffordances?: EnvironmentAffordanceRef[]
    affordancesProvided?: AffordanceProvidedRef[]
}

export type ParsedCandidateTropeAssignment = {
    executionDetail: string
    members: ParsedCandidateMember[]
}

export type ParsedCandidate = {
    candidateId: string
    executionSummary: string
    tropeAssignments: Partial<Record<CoyoteTrope, ParsedCandidateTropeAssignment>>
}

export type ParseCandidateOutputSuccess = {
    ok: true
    /** Canonical JSON string after validation (debug / tests). */
    normalizedJson: string
    candidates: ParsedCandidate[]
}

export type ParseCandidateOutputFailure = {
    ok: false
    errorMessage: string
}

export type ParseCandidateOutputResult = ParseCandidateOutputSuccess | ParseCandidateOutputFailure

/** Strips a leading markdown ``` / ```json fence and trailing ``` when present. */
export function stripCandidateOutputFence(body: string): string {
    let s = body.trim()
    const fenceOpen = /^```(?:json|markdown|md|text)?\s*\r?\n?/
    const fenceClose = /\r?\n```\s*$/
    if (fenceOpen.test(s)) {
        s = s.replace(fenceOpen, '').replace(fenceClose, '').trim()
    }
    return s
}

function normalizeNewlines(text: string): string {
    return text.replace(/\r\n/g, '\n')
}

function extractJsonObjectString(text: string): string | null {
    const t = stripCandidateOutputFence(normalizeNewlines(text).trim())
    if (!t.length) {
        return null
    }
    try {
        JSON.parse(t)
        return t
    } catch {
        /* fall through */
    }
    const start = t.indexOf('{')
    if (start < 0) {
        return null
    }
    let depth = 0
    let inString = false
    let escape = false
    for (let i = start; i < t.length; i++) {
        const c = t[i]
        if (inString) {
            if (escape) {
                escape = false
            } else if (c === '\\') {
                escape = true
            } else if (c === '"') {
                inString = false
            }
            continue
        }
        if (c === '"') {
            inString = true
            continue
        }
        if (c === '{') {
            depth += 1
        } else if (c === '}') {
            depth -= 1
            if (depth === 0) {
                return t.slice(start, i + 1)
            }
        }
    }
    return null
}

function expectedStableKeysSorted(
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): string[] {
    const keys: string[] = []
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            keys.push(o.stableKey.trim())
        }
    }
    return keys.map((k) => k).sort()
}

function isNonEmptyString(x: unknown): x is string {
    return typeof x === 'string' && x.trim().length > 0
}

const STAGE_ONE_ROOT_ALLOWED_KEYS = new Set(['candidates', 'notes'])
const STAGE_ONE_CANDIDATE_ALLOWED_KEYS = new Set([
    'candidateId',
    'executionSummary',
    'tropeAssignments',
    'outliers',
])
const STAGE_ONE_TROPE_ASSIGNMENT_ALLOWED_KEYS = new Set(['executionDetail', 'members'])
const STAGE_ONE_MEMBER_ALLOWED_KEYS = new Set([
    'stableKey',
    'tropeFunction',
    'environmentAffordances',
    'affordancesProvided',
])
const STAGE_ONE_OUTLIER_ALLOWED_KEYS = new Set(['stableKey', 'environmentAffordances', 'affordancesProvided'])
const TROPE_ORDER: CoyoteTrope[] = CANONICAL_TROPE_ORDER

function unknownKeys(
    candidate: Record<string, unknown>,
    allowed: Set<string>
): string[] {
    return Object.keys(candidate).filter((key) => !allowed.has(key))
}

type DraftMember = {
    stableKey: string
    tropeFunction: string
    environmentAffordances?: EnvironmentAffordanceRef[]
    affordancesProvided?: AffordanceProvidedRef[]
}

function parseOptionalAffordances(
    rawObj: Record<string, unknown>,
    contextLabel: string
): {
    ok: true
    environmentAffordances?: EnvironmentAffordanceRef[]
    affordancesProvided?: AffordanceProvidedRef[]
} | { ok: false; errorMessage: string } {
    if ('environmentAffordances' in rawObj && rawObj.environmentAffordances !== undefined) {
        if (
            !Array.isArray(rawObj.environmentAffordances)
            || !rawObj.environmentAffordances.every((entry) => isEnvironmentAffordanceRef(entry))
        ) {
            return {
                ok: false,
                errorMessage: `${contextLabel} has malformed environmentAffordances`,
            }
        }
    }
    if ('affordancesProvided' in rawObj && rawObj.affordancesProvided !== undefined) {
        if (
            !Array.isArray(rawObj.affordancesProvided)
            || !rawObj.affordancesProvided.every((entry) => isAffordanceProvidedRef(entry))
        ) {
            return {
                ok: false,
                errorMessage: `${contextLabel} has malformed affordancesProvided`,
            }
        }
    }
    return {
        ok: true,
        ...(
            Array.isArray(rawObj.environmentAffordances) && rawObj.environmentAffordances.length > 0
                ? { environmentAffordances: rawObj.environmentAffordances }
                : {}
        ),
        ...(
            Array.isArray(rawObj.affordancesProvided) && rawObj.affordancesProvided.length > 0
                ? { affordancesProvided: rawObj.affordancesProvided }
                : {}
        ),
    }
}

function parseDraftMemberFromRecord(
    mo: Record<string, unknown>,
    contextLabel: string
): { ok: true; draft: DraftMember } | { ok: false; errorMessage: string } {
    if (!isNonEmptyString(mo.stableKey)) {
        return { ok: false, errorMessage: `${contextLabel} needs stableKey` }
    }
    const stableKey = mo.stableKey.trim()
    if (!isNonEmptyString(mo.tropeFunction)) {
        return { ok: false, errorMessage: `${contextLabel} needs non-empty tropeFunction` }
    }
    const parsedAffordances = parseOptionalAffordances(mo, contextLabel)
    if (!parsedAffordances.ok) {
        return parsedAffordances
    }

    return {
        ok: true,
        draft: {
            stableKey,
            tropeFunction: mo.tropeFunction.trim(),
            ...(parsedAffordances.environmentAffordances !== undefined
                ? { environmentAffordances: parsedAffordances.environmentAffordances }
                : {}),
            ...(parsedAffordances.affordancesProvided !== undefined
                ? { affordancesProvided: parsedAffordances.affordancesProvided }
                : {}),
        },
    }
}

function resolveDraftMembers(
    drafts: DraftMember[],
    snapshotByStableKey: Map<string, EphemeraMetaRoomObject>
): { ok: true; members: ParsedCandidateMember[] } | { ok: false; errorMessage: string } {
    const membersOut: ParsedCandidateMember[] = []
    for (const dm of drafts) {
        const obj = snapshotByStableKey.get(dm.stableKey.trim())
        if (!obj) {
            return { ok: false, errorMessage: `stage 1 JSON: unknown stableKey "${dm.stableKey}"` }
        }
        membersOut.push({
            stableKey: dm.stableKey,
            tropeFunction: dm.tropeFunction,
            ...(dm.environmentAffordances !== undefined
                ? { environmentAffordances: dm.environmentAffordances }
                : {}),
            ...(dm.affordancesProvided !== undefined
                ? { affordancesProvided: dm.affordancesProvided }
                : {}),
        })
    }
    return { ok: true, members: membersOut }
}

function parseOutlierStableKeyOnly(
    rawObj: Record<string, unknown>,
    contextLabel: string
): { ok: true; stableKey: string } | { ok: false; errorMessage: string } {
    if (!isNonEmptyString(rawObj.stableKey)) {
        return { ok: false, errorMessage: `${contextLabel} needs stableKey` }
    }
    const parsedAffordances = parseOptionalAffordances(rawObj, contextLabel)
    if (!parsedAffordances.ok) {
        return parsedAffordances
    }
    return { ok: true, stableKey: rawObj.stableKey.trim() }
}

function parseCandidatesFromPayload(
    payload: unknown,
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): {
    ok: true
    candidates: ParsedCandidate[]
} | { ok: false; errorMessage: string } {
    if (typeof payload !== 'object' || payload === null) {
        return { ok: false, errorMessage: 'stage 1 JSON: root must be an object' }
    }
    const root = payload as Record<string, unknown>
    const unknownRootKeys = unknownKeys(root, STAGE_ONE_ROOT_ALLOWED_KEYS)
    if (unknownRootKeys.length > 0) {
        return {
            ok: false,
            errorMessage: `stage 1 JSON: unknown root key(s): ${unknownRootKeys.join(', ')}`,
        }
    }

    if (root.notes !== undefined && typeof root.notes !== 'string') {
        return { ok: false, errorMessage: 'stage 1 JSON: notes must be a string when present' }
    }

    const candidatesRaw = root.candidates
    if (!Array.isArray(candidatesRaw)) {
        return { ok: false, errorMessage: 'stage 1 JSON: missing or invalid candidates array' }
    }

    const expectedCount = expectedStableKeysSorted(roomObjectsByRoom).length
    if (expectedCount === 0) {
        return { ok: false, errorMessage: 'stage 1 JSON: no staged objects to cluster' }
    }

    if (candidatesRaw.length < 1) {
        return {
            ok: false,
            errorMessage: 'stage 1 JSON: candidates must be a non-empty array',
        }
    }

    const candidates: ParsedCandidate[] = []
    for (let ci = 0; ci < candidatesRaw.length; ci++) {
        const c = candidatesRaw[ci]
        if (typeof c !== 'object' || c === null) {
            return { ok: false, errorMessage: `stage 1 JSON: candidate ${ci} must be an object` }
        }
        const co = c as Record<string, unknown>
        const unknownClusterKeys = unknownKeys(co, STAGE_ONE_CANDIDATE_ALLOWED_KEYS)
        if (unknownClusterKeys.length > 0) {
            return {
                ok: false,
                errorMessage: `stage 1 JSON: candidate ${ci} has unknown key(s): ${unknownClusterKeys.join(', ')}`,
            }
        }
        if (!isNonEmptyString(co.candidateId)) {
            return { ok: false, errorMessage: `stage 1 JSON: candidate ${ci} needs non-empty candidateId` }
        }
        if (!isNonEmptyString(co.executionSummary)) {
            return {
                ok: false,
                errorMessage: `stage 1 JSON: candidate "${co.candidateId}" needs non-empty executionSummary`,
            }
        }
        const candidateId = co.candidateId.trim()
        const executionSummary = co.executionSummary.trim()
        const tropeAssignmentsRaw = co.tropeAssignments
        if (
            typeof tropeAssignmentsRaw !== 'object'
            || tropeAssignmentsRaw === null
            || Array.isArray(tropeAssignmentsRaw)
        ) {
            return { ok: false, errorMessage: `stage 1 JSON: candidate "${candidateId}" needs tropeAssignments` }
        }

        const tropeAssignmentsRecord = tropeAssignmentsRaw as Record<string, unknown>
        const tropeKeys = Object.keys(tropeAssignmentsRecord)
        if (tropeKeys.length < 1) {
            return { ok: false, errorMessage: `stage 1 JSON: candidate "${candidateId}" needs tropeAssignments` }
        }

        const tropeAssignmentsDraft: Partial<Record<CoyoteTrope, { executionDetail: string; members: DraftMember[] }>> = {}
        for (const tropeKey of tropeKeys) {
            if (!isCoyoteTrope(tropeKey)) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" tropeAssignments has invalid trope key "${tropeKey}"`,
                }
            }
            const ta = tropeAssignmentsRecord[tropeKey]
            if (typeof ta !== 'object' || ta === null || Array.isArray(ta)) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" trope "${tropeKey}" must be an object`,
                }
            }
            const tao = ta as Record<string, unknown>
            const unknownMemberKeys = unknownKeys(tao, STAGE_ONE_TROPE_ASSIGNMENT_ALLOWED_KEYS)
            if (unknownMemberKeys.length > 0) {
                return {
                    ok: false,
                    errorMessage:
                        `stage 1 JSON: candidate "${candidateId}" trope "${tropeKey}" has unknown key(s): ` +
                        unknownMemberKeys.join(', '),
                }
            }
            if (!isNonEmptyString(tao.executionDetail)) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" trope "${tropeKey}" needs non-empty executionDetail`,
                }
            }
            const membersRaw = tao.members
            if (!Array.isArray(membersRaw) || membersRaw.length < 1) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" trope "${tropeKey}" needs a non-empty members array`,
                }
            }
            const membersDraft: DraftMember[] = []
            for (let mi = 0; mi < membersRaw.length; mi++) {
                const mem = membersRaw[mi]
                if (typeof mem !== 'object' || mem === null) {
                    return {
                        ok: false,
                        errorMessage: `stage 1 JSON: candidate "${candidateId}" trope "${tropeKey}" member ${mi} must be an object`,
                    }
                }
                const mo = mem as Record<string, unknown>
                const unknownMemberKeysForItem = unknownKeys(mo, STAGE_ONE_MEMBER_ALLOWED_KEYS)
                if (unknownMemberKeysForItem.length > 0) {
                    return {
                        ok: false,
                        errorMessage:
                            `stage 1 JSON: candidate "${candidateId}" trope "${tropeKey}" member ${mi} has unknown key(s): ` +
                            unknownMemberKeysForItem.join(', '),
                    }
                }
                const parsedM = parseDraftMemberFromRecord(
                    mo,
                    `stage 1 JSON: candidate "${candidateId}" trope "${tropeKey}" member ${mi}`
                )
                if (!parsedM.ok) {
                    return parsedM
                }
                membersDraft.push(parsedM.draft)
            }

            tropeAssignmentsDraft[tropeKey] = {
                executionDetail: tao.executionDetail.trim(),
                members: membersDraft,
            }
        }

        const stagedMultisetSorted = expectedStableKeysSorted(roomObjectsByRoom)
        const assignmentKeysList = Object.values(tropeAssignmentsDraft).flatMap((assignment) =>
            (assignment?.members ?? []).map((m) => m.stableKey.trim())
        )
        const stagedCounts = new Map<string, number>()
        for (const sk of stagedMultisetSorted) {
            stagedCounts.set(sk, (stagedCounts.get(sk) ?? 0) + 1)
        }
        const assignmentCounts = new Map<string, number>()
        for (const sk of assignmentKeysList) {
            assignmentCounts.set(sk, (assignmentCounts.get(sk) ?? 0) + 1)
        }
        for (const [sk, ac] of assignmentCounts) {
            const sc = stagedCounts.get(sk) ?? 0
            if (ac > sc) {
                return {
                    ok: false,
                    errorMessage:
                        `stage 1 JSON: candidate "${candidateId}" tropeAssignments use stableKey "${sk}" ` +
                        `more often (${ac}) than it appears in the staged snapshot (${sc})`,
                }
            }
        }

        const snapshotByStableKey = new Map<string, EphemeraMetaRoomObject>()
        for (const objects of Object.values(roomObjectsByRoom)) {
            for (const o of objects) {
                snapshotByStableKey.set(o.stableKey.trim(), o)
            }
        }

        const hasOutliersKey = Object.prototype.hasOwnProperty.call(co, 'outliers')
        if (hasOutliersKey) {
            if (!Array.isArray(co.outliers)) {
                return { ok: false, errorMessage: `stage 1 JSON: candidate "${candidateId}" outliers must be an array when present` }
            }
            for (let oi = 0; oi < co.outliers.length; oi++) {
                const raw = co.outliers[oi]
                if (typeof raw !== 'object' || raw === null) {
                    return { ok: false, errorMessage: `stage 1 JSON: candidate "${candidateId}" outliers[${oi}] must be an object` }
                }
                const rawObj = raw as Record<string, unknown>
                const unknownOutlierKeys = unknownKeys(rawObj, STAGE_ONE_OUTLIER_ALLOWED_KEYS)
                if (unknownOutlierKeys.length > 0) {
                    return {
                        ok: false,
                        errorMessage:
                            `stage 1 JSON: candidate "${candidateId}" outliers[${oi}] has unknown key(s): ` +
                            unknownOutlierKeys.join(', '),
                    }
                }
                const parsedO = parseOutlierStableKeyOnly(
                    rawObj,
                    `stage 1 JSON: candidate "${candidateId}" outliers[${oi}]`
                )
                if (!parsedO.ok) {
                    return parsedO
                }
                if (!snapshotByStableKey.has(parsedO.stableKey)) {
                    return {
                        ok: false,
                        errorMessage: `stage 1 JSON: unknown stableKey "${parsedO.stableKey}" in outliers[${oi}]`,
                    }
                }
            }
        }

        const tropeAssignments: Partial<Record<CoyoteTrope, ParsedCandidateTropeAssignment>> = {}
        for (const trope of TROPE_ORDER) {
            const draft = tropeAssignmentsDraft[trope]
            if (!draft) {
                continue
            }
            const resolvedMembers = resolveDraftMembers(draft.members, snapshotByStableKey)
            if (!resolvedMembers.ok) {
                return resolvedMembers
            }
            tropeAssignments[trope] = {
                executionDetail: draft.executionDetail,
                members: resolvedMembers.members,
            }
        }
        candidates.push({
            candidateId,
            executionSummary,
            tropeAssignments,
        })
    }

    return { ok: true, candidates }
}

/**
 * Validates stage-1 Bedrock JSON body and returns parsed trope candidates.
 */
export function parseCandidateOutput(
    rawBody: string,
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): ParseCandidateOutputResult {
    const jsonStr = extractJsonObjectString(rawBody)
    if (!jsonStr) {
        return { ok: false, errorMessage: 'stage 1 JSON: empty body or no JSON object found' }
    }

    let payload: unknown
    try {
        payload = JSON.parse(jsonStr)
    } catch {
        return { ok: false, errorMessage: 'stage 1 JSON: JSON.parse failed' }
    }

    const parsed = parseCandidatesFromPayload(payload, roomObjectsByRoom)
    if (!parsed.ok) {
        return parsed
    }

    const notes =
        typeof payload === 'object' && payload !== null && typeof (payload as { notes?: unknown }).notes === 'string'
            ? (payload as { notes: string }).notes
            : undefined

    const normalizedPayload: Record<string, unknown> = {
        candidates: parsed.candidates,
    }
    if (notes !== undefined) {
        normalizedPayload.notes = notes
    }

    return {
        ok: true,
        normalizedJson: JSON.stringify(normalizedPayload),
        candidates: parsed.candidates,
    }
}
