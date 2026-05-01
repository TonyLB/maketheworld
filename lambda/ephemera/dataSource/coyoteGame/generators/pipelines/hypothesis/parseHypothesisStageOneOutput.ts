import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    CoyoteTrope,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

/*
 * Stage 1 emits trope-first JSON: optional notes, required candidates[].
 * Each candidate includes tropeAssignments[]; optional outliers[] is scaffolding only (stableKey-only).
 * Trope members use stableKey + required tropeFunction. Authoritative outliers are derived in combine.
 */

/** One staged object reference under a trope assignment `members` row. */
export type ParsedClusterMember = {
    stableKey: string
    tropeFunction: string
}

export type ParsedTropeAssignment = {
    trope: CoyoteTrope
    executionDetail: string
    members: ParsedClusterMember[]
}

export type ParsedTropeCandidate = {
    candidateId: string
    executionSummary: string
    tropeAssignments: ParsedTropeAssignment[]
}

export type ParseHypothesisStageOneSuccess = {
    ok: true
    /** Canonical JSON string after validation (debug / tests). */
    normalizedJson: string
    candidates: ParsedTropeCandidate[]
}

export type ParseHypothesisStageOneFailure = {
    ok: false
    errorMessage: string
}

export type ParseHypothesisStageOneResult = ParseHypothesisStageOneSuccess | ParseHypothesisStageOneFailure

/** Strips a leading markdown ``` / ```json fence and trailing ``` when present. */
export function stripHypothesisStageOneFence(body: string): string {
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
    const t = stripHypothesisStageOneFence(normalizeNewlines(text).trim())
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
const STAGE_ONE_TROPE_ASSIGNMENT_ALLOWED_KEYS = new Set(['trope', 'executionDetail', 'members'])
const STAGE_ONE_MEMBER_ALLOWED_KEYS = new Set(['stableKey', 'tropeFunction'])
const STAGE_ONE_OUTLIER_ALLOWED_KEYS = new Set(['stableKey'])
const TROPE_ORDER: CoyoteTrope[] = ['Contraption', 'Distraction', 'Disadvantage', 'Finishing Move']
const TROPE_ORDER_INDEX = new Map(TROPE_ORDER.map((trope, i) => [trope, i]))

function unknownKeys(
    candidate: Record<string, unknown>,
    allowed: Set<string>
): string[] {
    return Object.keys(candidate).filter((key) => !allowed.has(key))
}

type DraftMember = {
    stableKey: string
    tropeFunction: string
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

    return { ok: true, draft: { stableKey, tropeFunction: mo.tropeFunction.trim() } }
}

function resolveDraftMembers(
    drafts: DraftMember[],
    snapshotByStableKey: Map<string, EphemeraMetaRoomObject>
): { ok: true; members: ParsedClusterMember[] } | { ok: false; errorMessage: string } {
    const membersOut: ParsedClusterMember[] = []
    for (const dm of drafts) {
        const obj = snapshotByStableKey.get(dm.stableKey.trim())
        if (!obj) {
            return { ok: false, errorMessage: `stage 1 JSON: unknown stableKey "${dm.stableKey}"` }
        }
        membersOut.push({ stableKey: dm.stableKey, tropeFunction: dm.tropeFunction })
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
    return { ok: true, stableKey: rawObj.stableKey.trim() }
}

function parseCandidatesFromPayload(
    payload: unknown,
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): {
    ok: true
    candidates: ParsedTropeCandidate[]
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

    const candidates: ParsedTropeCandidate[] = []
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
        if (!Array.isArray(tropeAssignmentsRaw) || tropeAssignmentsRaw.length < 1) {
            return { ok: false, errorMessage: `stage 1 JSON: candidate "${candidateId}" needs tropeAssignments` }
        }

        const tropeAssignmentsDraft: Array<{ trope: CoyoteTrope; executionDetail: string; members: DraftMember[] }> = []
        let previousTropeIndex = -1
        const seenTropes = new Set<CoyoteTrope>()
        for (let ti = 0; ti < tropeAssignmentsRaw.length; ti++) {
            const ta = tropeAssignmentsRaw[ti]
            if (typeof ta !== 'object' || ta === null) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" tropeAssignments[${ti}] must be an object`,
                }
            }
            const tao = ta as Record<string, unknown>
            const unknownMemberKeys = unknownKeys(tao, STAGE_ONE_TROPE_ASSIGNMENT_ALLOWED_KEYS)
            if (unknownMemberKeys.length > 0) {
                return {
                    ok: false,
                    errorMessage:
                        `stage 1 JSON: candidate "${candidateId}" tropeAssignments[${ti}] has unknown key(s): ` +
                        unknownMemberKeys.join(', '),
                }
            }
            if (!isCoyoteTrope(tao.trope)) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" tropeAssignments[${ti}] has invalid trope`,
                }
            }
            if (seenTropes.has(tao.trope)) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" repeats trope "${tao.trope}"`,
                }
            }
            const tropeIndex = TROPE_ORDER_INDEX.get(tao.trope)!
            if (tropeIndex < previousTropeIndex) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" tropeAssignments are out of canonical trope order`,
                }
            }
            previousTropeIndex = tropeIndex
            seenTropes.add(tao.trope)
            if (!isNonEmptyString(tao.executionDetail)) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" trope "${tao.trope}" needs non-empty executionDetail`,
                }
            }
            const membersRaw = tao.members
            if (!Array.isArray(membersRaw) || membersRaw.length < 1) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: candidate "${candidateId}" trope "${tao.trope}" needs a non-empty members array`,
                }
            }
            const membersDraft: DraftMember[] = []
            for (let mi = 0; mi < membersRaw.length; mi++) {
                const mem = membersRaw[mi]
                if (typeof mem !== 'object' || mem === null) {
                    return {
                        ok: false,
                        errorMessage: `stage 1 JSON: candidate "${candidateId}" trope "${tao.trope}" member ${mi} must be an object`,
                    }
                }
                const mo = mem as Record<string, unknown>
                const unknownMemberKeysForItem = unknownKeys(mo, STAGE_ONE_MEMBER_ALLOWED_KEYS)
                if (unknownMemberKeysForItem.length > 0) {
                    return {
                        ok: false,
                        errorMessage:
                            `stage 1 JSON: candidate "${candidateId}" trope "${tao.trope}" member ${mi} has unknown key(s): ` +
                            unknownMemberKeysForItem.join(', '),
                    }
                }
                const parsedM = parseDraftMemberFromRecord(
                    mo,
                    `stage 1 JSON: candidate "${candidateId}" trope "${tao.trope}" member ${mi}`
                )
                if (!parsedM.ok) {
                    return parsedM
                }
                membersDraft.push(parsedM.draft)
            }

            tropeAssignmentsDraft.push({
                trope: tao.trope,
                executionDetail: tao.executionDetail.trim(),
                members: membersDraft,
            })
        }

        const stagedMultisetSorted = expectedStableKeysSorted(roomObjectsByRoom)
        const assignmentKeysList = tropeAssignmentsDraft.flatMap((assignment) =>
            assignment.members.map((m) => m.stableKey.trim())
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

        const tropeAssignments: ParsedTropeAssignment[] = []
        for (const draft of tropeAssignmentsDraft) {
            const resolvedMembers = resolveDraftMembers(draft.members, snapshotByStableKey)
            if (!resolvedMembers.ok) {
                return resolvedMembers
            }
            tropeAssignments.push({
                trope: draft.trope,
                executionDetail: draft.executionDetail,
                members: resolvedMembers.members,
            })
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
export function parseHypothesisStageOneOutput(
    rawBody: string,
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): ParseHypothesisStageOneResult {
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
