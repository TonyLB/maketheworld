import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    CoyoteTrope,
    CoyoteAffinityPossibility,
    CoyoteAffinityPossibilityEcho,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteAffinityPossibilityEcho, isCoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

/*
 * Stage 1 emits trope-first JSON: optional notes, required candidates[].
 * Each candidate includes tropeAssignments[] and optional outliers[] (partition with members).
 * members/outliers use stableKey + optional intendedRole echo (CoyoteAffinityPossibilityEcho).
 */

/** One staged object reference in a cluster or in **`outliers`**. */
export type ParsedClusterMember = {
    stableKey: string
    intendedRole?: CoyoteAffinityPossibility
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
    explicitOutliers?: ParsedClusterMember[]
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
const STAGE_ONE_MEMBER_ALLOWED_KEYS = new Set(['stableKey', 'intendedRole'])
const TROPE_ORDER: CoyoteTrope[] = ['Contraption', 'Distraction', 'Disadvantage', 'Finishing Move']
const TROPE_ORDER_INDEX = new Map(TROPE_ORDER.map((trope, i) => [trope, i]))

function unknownKeys(
    candidate: Record<string, unknown>,
    allowed: Set<string>
): string[] {
    return Object.keys(candidate).filter((key) => !allowed.has(key))
}

function resolveEchoToStoredRow(
    obj: EphemeraMetaRoomObject,
    echo: CoyoteAffinityPossibilityEcho
): CoyoteAffinityPossibility | undefined {
    const aff = obj.affinities
    if (!aff || aff.length === 0 || obj.affinitiesFailed === true) {
        return undefined
    }
    const candidates = aff.filter((stored) => {
        return stored.role === echo.role
    })
    if (candidates.length === 0) {
        return undefined
    }
    if (echo.aptness !== undefined && Number.isFinite(echo.aptness)) {
        return candidates.find((s) => Math.abs(s.aptness - echo.aptness!) < 1e-6)
    }
    // Deterministic fallback for role-only echoes: pick highest-aptness persisted row for that role.
    const sorted = [...candidates].sort((a, b) => b.aptness - a.aptness)
    return sorted[0]
}

type DraftMember = {
    stableKey: string
    echo?: CoyoteAffinityPossibilityEcho
}

function parseDraftMemberFromRecord(
    mo: Record<string, unknown>,
    contextLabel: string
): { ok: true; draft: DraftMember } | { ok: false; errorMessage: string } {
    if (!isNonEmptyString(mo.stableKey)) {
        return { ok: false, errorMessage: `${contextLabel} needs stableKey` }
    }
    const stableKey = mo.stableKey.trim()

    let echo: CoyoteAffinityPossibilityEcho | undefined
    if (mo.intendedRole !== undefined) {
        if (!isCoyoteAffinityPossibilityEcho(mo.intendedRole)) {
            return {
                ok: false,
                errorMessage: `${contextLabel}: intendedRole for "${stableKey}" is not a valid affinity echo`,
            }
        }
        echo = mo.intendedRole
    }

    return { ok: true, draft: { stableKey, echo } }
}

function resolveDraftMembers(
    drafts: DraftMember[],
    snapshotByStableKey: Map<string, EphemeraMetaRoomObject>,
    kind: 'cluster' | 'outlier'
): { ok: true; members: ParsedClusterMember[] } | { ok: false; errorMessage: string } {
    const membersOut: ParsedClusterMember[] = []
    for (const dm of drafts) {
        const obj = snapshotByStableKey.get(dm.stableKey.trim())
        if (!obj) {
            return { ok: false, errorMessage: `stage 1 JSON: unknown stableKey "${dm.stableKey}"` }
        }
        if (dm.echo === undefined) {
            membersOut.push({ stableKey: dm.stableKey })
            continue
        }
        const aff = obj.affinities
        if (!aff || aff.length === 0 || obj.affinitiesFailed === true) {
            return {
                ok: false,
                errorMessage: `stage 1 JSON: intendedRole given for ${dm.stableKey} (${kind}) but affinities unavailable`,
            }
        }
        const resolved = resolveEchoToStoredRow(obj, dm.echo)
        if (!resolved) {
            return {
                ok: false,
                errorMessage:
                    `stage 1 JSON: intendedRole ${JSON.stringify(dm.echo)} does not resolve to a stored affinity for ` +
                    `${dm.stableKey} (${kind}); echo one persisted role from that object's affinities`,
            }
        }
        membersOut.push({ stableKey: dm.stableKey, intendedRole: resolved })
    }
    return { ok: true, members: membersOut }
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

        const expectedSorted = JSON.stringify(expectedStableKeysSorted(roomObjectsByRoom))
        const assignmentKeysSorted = tropeAssignmentsDraft
            .flatMap((assignment) => assignment.members.map((m) => m.stableKey.trim()))
            .sort()
        const hasExplicitOutliers = Object.prototype.hasOwnProperty.call(co, 'outliers')
        let draftOutliers: DraftMember[] | undefined
        if (hasExplicitOutliers) {
            if (!Array.isArray(co.outliers)) {
                return { ok: false, errorMessage: `stage 1 JSON: candidate "${candidateId}" outliers must be an array when present` }
            }
            draftOutliers = []
            for (let oi = 0; oi < co.outliers.length; oi++) {
                const raw = co.outliers[oi]
                if (typeof raw !== 'object' || raw === null) {
                    return { ok: false, errorMessage: `stage 1 JSON: candidate "${candidateId}" outliers[${oi}] must be an object` }
                }
                const rawObj = raw as Record<string, unknown>
                const unknownOutlierKeys = unknownKeys(rawObj, STAGE_ONE_MEMBER_ALLOWED_KEYS)
                if (unknownOutlierKeys.length > 0) {
                    return {
                        ok: false,
                        errorMessage:
                            `stage 1 JSON: candidate "${candidateId}" outliers[${oi}] has unknown key(s): ` +
                            unknownOutlierKeys.join(', '),
                    }
                }
                const parsedO = parseDraftMemberFromRecord(
                    rawObj,
                    `stage 1 JSON: candidate "${candidateId}" outliers[${oi}]`
                )
                if (!parsedO.ok) {
                    return parsedO
                }
                draftOutliers.push(parsedO.draft)
            }
            const outlierKeysSorted = draftOutliers.map((d) => d.stableKey.trim()).sort()
            const assignmentKeySet = new Set(assignmentKeysSorted)
            for (const ok of outlierKeysSorted) {
                if (assignmentKeySet.has(ok)) {
                    return {
                        ok: false,
                        errorMessage: `stage 1 JSON: candidate "${candidateId}" stableKey "${ok}" appears in both tropeAssignments and outliers`,
                    }
                }
            }
            const unionSorted = [...assignmentKeysSorted, ...outlierKeysSorted].sort()
            if (JSON.stringify(unionSorted) !== expectedSorted) {
                return {
                    ok: false,
                    errorMessage:
                        `stage 1 JSON: candidate "${candidateId}" tropeAssignments ∪ outliers must equal staged multiset ` +
                        `(expected ${expectedSorted}, got ${JSON.stringify(unionSorted)})`,
                }
            }
        } else {
            const parsedSorted = JSON.stringify(assignmentKeysSorted)
            if (
                assignmentKeysSorted.length !== expectedStableKeysSorted(roomObjectsByRoom).length
                || parsedSorted !== expectedSorted
            ) {
                return {
                    ok: false,
                    errorMessage:
                        `stage 1 JSON: candidate "${candidateId}" stableKey multiset mismatch ` +
                        `(expected ${expectedSorted}, parsed ${parsedSorted})`,
                }
            }
        }

        const snapshotByStableKey = new Map<string, EphemeraMetaRoomObject>()
        for (const objects of Object.values(roomObjectsByRoom)) {
            for (const o of objects) {
                snapshotByStableKey.set(o.stableKey.trim(), o)
            }
        }
        const tropeAssignments: ParsedTropeAssignment[] = []
        for (const draft of tropeAssignmentsDraft) {
            const resolvedMembers = resolveDraftMembers(draft.members, snapshotByStableKey, 'cluster')
            if (!resolvedMembers.ok) {
                return resolvedMembers
            }
            tropeAssignments.push({
                trope: draft.trope,
                executionDetail: draft.executionDetail,
                members: resolvedMembers.members,
            })
        }
        let explicitOutliers: ParsedClusterMember[] | undefined
        if (hasExplicitOutliers && draftOutliers !== undefined) {
            const resolvedOut = resolveDraftMembers(draftOutliers, snapshotByStableKey, 'outlier')
            if (!resolvedOut.ok) {
                return resolvedOut
            }
            explicitOutliers = resolvedOut.members
        }
        candidates.push({
            candidateId,
            executionSummary,
            tropeAssignments,
            ...(explicitOutliers !== undefined ? { explicitOutliers } : {}),
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
