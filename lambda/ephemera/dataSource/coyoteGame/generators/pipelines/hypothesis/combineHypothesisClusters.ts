import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    CombineClustersReturn,
    ClusterMemberPair,
} from '@tonylb/mtw-interfaces/ts/coyoteCombineClusters'
import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

import type { ParsedCluster, ParsedClusterMember } from './parseHypothesisStageOneOutput'
import { formatCoyoteAffinityPossibility } from '../../../coyoteRoomObjectSnapshot'
import type { CoyoteRoomObjectsByRoom } from '../../../coyoteRoomObjectSnapshot'

export type CombineHypothesisClustersSuccess = {
    ok: true
    combined: CombineClustersReturn
}

export type CombineHypothesisClustersFailure = {
    ok: false
    errorMessage: string
}

export type CombineHypothesisClustersResult = CombineHypothesisClustersSuccess | CombineHypothesisClustersFailure

function affinityMatchesStored(
    stored: CoyoteAffinityPossibility,
    echoed: CoyoteAffinityPossibility
): boolean {
    if (stored.role !== echoed.role) {
        return false
    }
    return Math.abs(stored.aptness - echoed.aptness) < 1e-6
}

function resolveCanonicalRole(
    obj: EphemeraMetaRoomObject,
    echoed?: CoyoteAffinityPossibility
): CoyoteAffinityPossibility | undefined {
    if (!echoed || !obj.affinities?.length || obj.affinitiesFailed === true) {
        return undefined
    }
    return obj.affinities.find((a) => affinityMatchesStored(a, echoed))
}

function resolveMemberIntendedRole(
    obj: EphemeraMetaRoomObject,
    echoed: CoyoteAffinityPossibility | undefined,
    context: string
): { ok: true; intendedRole?: CoyoteAffinityPossibility } | { ok: false; errorMessage: string } {
    if (echoed === undefined) {
        return { ok: true, intendedRole: undefined }
    }
    const intendedRole = resolveCanonicalRole(obj, echoed)
    if (!intendedRole) {
        return {
            ok: false,
            errorMessage: `combine: could not resolve canonical intendedRole for ${context}`,
        }
    }
    return { ok: true, intendedRole }
}

function snapshotIndexByStableKey(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): Map<string, EphemeraMetaRoomObject> {
    const map = new Map<string, EphemeraMetaRoomObject>()
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            map.set(o.stableKey.trim(), o)
        }
    }
    return map
}

/**
 * Hydrated DTO for Stage Two. When **`explicitOutliers`** is set (Stage One JSON included **`outliers`**),
 * outliers come only from that list; otherwise every staged **`stableKey`** missing from **`clusters`**
 * is listed as an outlier (complement fallback).
 */
export function combineHypothesisClusters(
    clusters: ParsedCluster[],
    roomObjectsByRoom: CoyoteRoomObjectsByRoom,
    explicitOutliers?: ParsedClusterMember[]
): CombineHypothesisClustersResult {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)

    const outClusters: CombineClustersReturn['clusters'] = []
    const seenKeys = new Set<string>()

    for (const pc of clusters) {
        const membersOut: ClusterMemberPair[] = []
        for (const mem of pc.members) {
            const sk = mem.stableKey.trim()
            const obj = byStableKey.get(sk)
            if (!obj) {
                return { ok: false, errorMessage: `combine: unknown stableKey "${sk}"` }
            }
            seenKeys.add(sk)

            const resolvedRole = resolveMemberIntendedRole(obj, mem.intendedRole, `"${sk}"`)
            if (!resolvedRole.ok) {
                return resolvedRole
            }

            const pair: ClusterMemberPair = {
                identifier: sk,
                intendedRole: resolvedRole.intendedRole,
            }
            membersOut.push(pair)
        }
        outClusters.push({
            clusterName: pc.clusterName,
            members: membersOut,
        })
    }

    let outliers: ClusterMemberPair[]

    if (explicitOutliers !== undefined) {
        outliers = []
        for (const mem of explicitOutliers) {
            const sk = mem.stableKey.trim()
            if (seenKeys.has(sk)) {
                return {
                    ok: false,
                    errorMessage: `combine: stableKey "${sk}" appears in both clusters and explicit outliers`,
                }
            }
            seenKeys.add(sk)
            const obj = byStableKey.get(sk)
            if (!obj) {
                return { ok: false, errorMessage: `combine: unknown outlier stableKey "${sk}"` }
            }
            const resolvedRole = resolveMemberIntendedRole(obj, mem.intendedRole, `outlier "${sk}"`)
            if (!resolvedRole.ok) {
                return resolvedRole
            }
            outliers.push({
                identifier: sk,
                intendedRole: resolvedRole.intendedRole,
            })
        }
    } else {
        outliers = []
        for (const objects of Object.values(roomObjectsByRoom)) {
            for (const o of objects) {
                const sk = o.stableKey.trim()
                if (!seenKeys.has(sk)) {
                    outliers.push({ identifier: sk })
                }
            }
        }
    }

    return {
        ok: true,
        combined: {
            clusters: outClusters,
            outliers,
        },
    }
}

/** Deterministic Markdown for Stage Two dynamic tail (combined-only contract). */
export function renderCombinedHypothesisForStageTwo(
    combined: CombineClustersReturn,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)

    const lines: string[] = ['## Combined clustering', '']

    for (const cl of combined.clusters) {
        lines.push(`### ${cl.clusterName}`, '')
        for (const mem of cl.members) {
            const sk = typeof mem.identifier === 'string' ? mem.identifier.trim() : ''
            const obj = sk ? byStableKey.get(sk) : undefined
            const shortName = obj?.shortName ?? sk
            const roomLabel = obj
                ? findRoomIdForObject(roomObjectsByRoom, obj)?.replace(/^ROOM#/, '') ?? ''
                : ''
            lines.push(
                `- **stableKey:** ${sk} — **shortName:** ${shortName}${roomLabel ? ` — **room:** ${roomLabel}` : ''}`
            )
            if (mem.intendedRole !== undefined) {
                lines.push(`  - **intendedRole:** ${formatCoyoteAffinityPossibility(mem.intendedRole)}`)
            }
            lines.push('')
        }
    }

    lines.push('## Outliers', '')
    if (combined.outliers.length === 0) {
        lines.push('(none)', '')
    } else {
        for (const out of combined.outliers) {
            const sk = typeof out.identifier === 'string' ? out.identifier.trim() : ''
            const obj = sk ? byStableKey.get(sk) : undefined
            const shortName = obj?.shortName ?? sk
            const roomLabel = obj
                ? findRoomIdForObject(roomObjectsByRoom, obj)?.replace(/^ROOM#/, '') ?? ''
                : ''
            lines.push(
                `- **stableKey:** ${sk} — **shortName:** ${shortName}${roomLabel ? ` — **room:** ${roomLabel}` : ''}`
            )
            if (out.intendedRole !== undefined) {
                lines.push(`  - **intendedRole:** ${formatCoyoteAffinityPossibility(out.intendedRole)}`)
            }
            lines.push('')
        }
    }

    return lines.join('\n').trimEnd()
}

function findRoomIdForObject(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom,
    target: EphemeraMetaRoomObject
): EphemeraRoomId | undefined {
    for (const [roomId, objects] of Object.entries(roomObjectsByRoom) as [
        EphemeraRoomId,
        EphemeraMetaRoomObject[],
    ][]) {
        if (objects.some((o) => o.uuid === target.uuid)) {
            return roomId
        }
    }
    return undefined
}
