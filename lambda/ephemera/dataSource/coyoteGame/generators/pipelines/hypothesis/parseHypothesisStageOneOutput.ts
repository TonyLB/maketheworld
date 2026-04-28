import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    CoyoteAffinityPossibility,
    CoyoteAffinityPossibilityEcho,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteAffinityPossibilityEcho } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

/*
 * Stage 1 emits JSON: optional notes, required clusters[], optional outliers[] (partition with clusters),
 * members use stableKey + optional intendedRole echo (CoyoteAffinityPossibilityEcho).
 */

/** One staged object reference in a cluster or in **`outliers`**. */
export type ParsedClusterMember = {
    stableKey: string
    intendedRole?: CoyoteAffinityPossibility
}

export type ParsedCluster = {
    clusterName: string
    members: ParsedClusterMember[]
}

export type ParseHypothesisStageOneSuccess = {
    ok: true
    /** Canonical JSON string after validation (debug / tests). */
    normalizedJson: string
    clusters: ParsedCluster[]
    /**
     * Present when the model included root **`outliers`** — **`combineHypothesisClusters`** hydrates these
     * instead of inferring complement from clusters. Omitted when **`outliers`** is absent (fallback: every
     * staged **`stableKey`** appears only in **`clusters`**).
     */
    explicitOutliers?: ParsedClusterMember[]
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

const STAGE_ONE_ROOT_ALLOWED_KEYS = new Set(['clusters', 'outliers', 'notes'])
const STAGE_ONE_CLUSTER_ALLOWED_KEYS = new Set(['clusterName', 'members'])
const STAGE_ONE_MEMBER_ALLOWED_KEYS = new Set(['stableKey', 'intendedRole'])

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

function parseClustersFromPayload(
    payload: unknown,
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): {
    ok: true
    clusters: ParsedCluster[]
    explicitOutliers?: ParsedClusterMember[]
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

    const clustersRaw = root.clusters
    if (!Array.isArray(clustersRaw)) {
        return { ok: false, errorMessage: 'stage 1 JSON: missing or invalid clusters array' }
    }

    const expectedCount = expectedStableKeysSorted(roomObjectsByRoom).length
    if (expectedCount === 0) {
        return { ok: false, errorMessage: 'stage 1 JSON: no staged objects to cluster' }
    }

    if (clustersRaw.length < 1 || clustersRaw.length > expectedCount) {
        return {
            ok: false,
            errorMessage: `stage 1 JSON: expected 1-${expectedCount} clusters, got ${clustersRaw.length}`,
        }
    }

    const draftClusters: { clusterName: string; members: DraftMember[] }[] = []

    for (let ci = 0; ci < clustersRaw.length; ci++) {
        const c = clustersRaw[ci]
        if (typeof c !== 'object' || c === null) {
            return { ok: false, errorMessage: `stage 1 JSON: cluster ${ci} must be an object` }
        }
        const co = c as Record<string, unknown>
        const unknownClusterKeys = unknownKeys(co, STAGE_ONE_CLUSTER_ALLOWED_KEYS)
        if (unknownClusterKeys.length > 0) {
            return {
                ok: false,
                errorMessage: `stage 1 JSON: cluster ${ci} has unknown key(s): ${unknownClusterKeys.join(', ')}`,
            }
        }
        if (!isNonEmptyString(co.clusterName)) {
            return { ok: false, errorMessage: `stage 1 JSON: cluster ${ci} needs non-empty clusterName` }
        }
        const clusterName = co.clusterName.trim()
        const membersRaw = co.members
        if (!Array.isArray(membersRaw) || membersRaw.length < 1) {
            return {
                ok: false,
                errorMessage: `stage 1 JSON: cluster "${clusterName}" needs a non-empty members array`,
            }
        }

        const membersDraft: DraftMember[] = []
        for (let mi = 0; mi < membersRaw.length; mi++) {
            const mem = membersRaw[mi]
            if (typeof mem !== 'object' || mem === null) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: cluster "${clusterName}" member ${mi} must be an object`,
                }
            }
            const mo = mem as Record<string, unknown>
            const unknownMemberKeys = unknownKeys(mo, STAGE_ONE_MEMBER_ALLOWED_KEYS)
            if (unknownMemberKeys.length > 0) {
                return {
                    ok: false,
                    errorMessage:
                        `stage 1 JSON: cluster "${clusterName}" member ${mi} has unknown key(s): ` +
                        unknownMemberKeys.join(', '),
                }
            }
            const parsedM = parseDraftMemberFromRecord(
                mo,
                `stage 1 JSON: cluster "${clusterName}" member ${mi}`
            )
            if (!parsedM.ok) {
                return parsedM
            }
            membersDraft.push(parsedM.draft)
        }

        draftClusters.push({ clusterName, members: membersDraft })
    }

    const clusterKeysSorted = draftClusters
        .flatMap((cl) => cl.members.map((m) => m.stableKey.trim()))
        .sort()

    const expectedSorted = JSON.stringify(expectedStableKeysSorted(roomObjectsByRoom))
    const hasExplicitOutliers = Object.prototype.hasOwnProperty.call(root, 'outliers')

    let draftOutliers: DraftMember[] | undefined
    if (hasExplicitOutliers) {
        if (!Array.isArray(root.outliers)) {
            return { ok: false, errorMessage: 'stage 1 JSON: outliers must be an array when present' }
        }
        draftOutliers = []
        for (let oi = 0; oi < root.outliers.length; oi++) {
            const raw = root.outliers[oi]
            if (typeof raw !== 'object' || raw === null) {
                return { ok: false, errorMessage: `stage 1 JSON: outliers[${oi}] must be an object` }
            }
            const rawObj = raw as Record<string, unknown>
            const unknownOutlierKeys = unknownKeys(rawObj, STAGE_ONE_MEMBER_ALLOWED_KEYS)
            if (unknownOutlierKeys.length > 0) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: outliers[${oi}] has unknown key(s): ${unknownOutlierKeys.join(', ')}`,
                }
            }
            const parsedO = parseDraftMemberFromRecord(
                rawObj,
                `stage 1 JSON: outliers[${oi}]`
            )
            if (!parsedO.ok) {
                return parsedO
            }
            draftOutliers.push(parsedO.draft)
        }

        const outlierKeysSorted = draftOutliers.map((d) => d.stableKey.trim()).sort()
        const clusterKeySet = new Set(clusterKeysSorted)
        for (const ok of outlierKeysSorted) {
            if (clusterKeySet.has(ok)) {
                return {
                    ok: false,
                    errorMessage: `stage 1 JSON: stableKey "${ok}" appears in both clusters and outliers`,
                }
            }
        }

        const unionSorted = [...clusterKeysSorted, ...outlierKeysSorted].sort()
        if (JSON.stringify(unionSorted) !== expectedSorted) {
            return {
                ok: false,
                errorMessage: `stage 1 JSON: clusters ∪ outliers must equal staged multiset (expected ${expectedSorted}, got ${JSON.stringify(unionSorted)})`,
            }
        }
    } else {
        const parsedSorted = JSON.stringify(clusterKeysSorted)
        if (
            clusterKeysSorted.length !== expectedStableKeysSorted(roomObjectsByRoom).length
            || parsedSorted !== expectedSorted
        ) {
            return {
                ok: false,
                errorMessage: `stage 1 JSON: stableKey multiset mismatch (expected ${expectedSorted}, parsed ${parsedSorted})`,
            }
        }
    }

    const snapshotByStableKey = new Map<string, EphemeraMetaRoomObject>()
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            snapshotByStableKey.set(o.stableKey.trim(), o)
        }
    }

    const clusters: ParsedCluster[] = []
    for (const dc of draftClusters) {
        const resolved = resolveDraftMembers(dc.members, snapshotByStableKey, 'cluster')
        if (!resolved.ok) {
            return resolved
        }
        clusters.push({ clusterName: dc.clusterName, members: resolved.members })
    }

    let explicitOutliers: ParsedClusterMember[] | undefined
    if (hasExplicitOutliers && draftOutliers !== undefined) {
        const resolvedOut = resolveDraftMembers(draftOutliers, snapshotByStableKey, 'outlier')
        if (!resolvedOut.ok) {
            return resolvedOut
        }
        explicitOutliers = resolvedOut.members
    }

    return { ok: true, clusters, explicitOutliers }
}

/**
 * Validates stage-1 Bedrock JSON body and returns parsed clusters.
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

    const parsed = parseClustersFromPayload(payload, roomObjectsByRoom)
    if (!parsed.ok) {
        return parsed
    }

    const notes =
        typeof payload === 'object' && payload !== null && typeof (payload as { notes?: unknown }).notes === 'string'
            ? (payload as { notes: string }).notes
            : undefined

    const normalizedPayload: Record<string, unknown> = {
        clusters: parsed.clusters,
    }
    if (parsed.explicitOutliers !== undefined) {
        normalizedPayload.outliers = parsed.explicitOutliers
    }
    if (notes !== undefined) {
        normalizedPayload.notes = notes
    }

    return {
        ok: true,
        normalizedJson: JSON.stringify(normalizedPayload),
        clusters: parsed.clusters,
        ...(parsed.explicitOutliers !== undefined ? { explicitOutliers: parsed.explicitOutliers } : {}),
    }
}
