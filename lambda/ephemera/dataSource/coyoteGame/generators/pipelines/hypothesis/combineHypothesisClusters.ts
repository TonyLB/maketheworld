import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

import type { ParsedTropeCandidate } from './parseHypothesisStageOneOutput'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

export type CombinedMemberPair = {
    identifier: string
    tropeFunction: string
}

export type CombinedTropeAssignment = {
    trope: CoyoteTrope
    executionDetail: string
    members: CombinedMemberPair[]
}

export type CombinedTropeCandidate = {
    candidateId: string
    executionSummary: string
    tropeAssignments: CombinedTropeAssignment[]
    outliers: CombinedMemberPair[]
}

export type CombineHypothesisClustersReturn = {
    candidates: CombinedTropeCandidate[]
}

export type CombineHypothesisClustersSuccess = {
    ok: true
    combined: CombineHypothesisClustersReturn
}

export type CombineHypothesisClustersFailure = {
    ok: false
    errorMessage: string
}

export type CombineHypothesisClustersResult = CombineHypothesisClustersSuccess | CombineHypothesisClustersFailure

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
    candidates: ParsedTropeCandidate[],
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): CombineHypothesisClustersResult {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)
    const combinedCandidates: CombinedTropeCandidate[] = []
    for (const candidate of candidates) {
        const seenKeys = new Set<string>()
        const tropeAssignments: CombinedTropeAssignment[] = []
        for (const tropeAssignment of candidate.tropeAssignments) {
            const membersOut: CombinedMemberPair[] = []
            for (const mem of tropeAssignment.members) {
                const sk = mem.stableKey.trim()
                if (seenKeys.has(sk)) {
                    return {
                        ok: false,
                        errorMessage:
                            `combine: candidate "${candidate.candidateId}" duplicate stableKey "${sk}" across trope assignments`,
                    }
                }
                const obj = byStableKey.get(sk)
                if (!obj) {
                    return { ok: false, errorMessage: `combine: unknown stableKey "${sk}"` }
                }
                seenKeys.add(sk)
                membersOut.push({
                    identifier: sk,
                    tropeFunction: mem.tropeFunction,
                })
            }
            tropeAssignments.push({
                trope: tropeAssignment.trope,
                executionDetail: tropeAssignment.executionDetail,
                members: membersOut,
            })
        }
        const outliers: CombinedMemberPair[] = []
        if (candidate.explicitOutliers !== undefined) {
            for (const outlier of candidate.explicitOutliers) {
                const sk = outlier.stableKey.trim()
                if (seenKeys.has(sk)) {
                    return {
                        ok: false,
                        errorMessage:
                            `combine: candidate "${candidate.candidateId}" stableKey "${sk}" appears in both trope assignments and explicit outliers`,
                    }
                }
                const obj = byStableKey.get(sk)
                if (!obj) {
                    return { ok: false, errorMessage: `combine: unknown outlier stableKey "${sk}"` }
                }
                seenKeys.add(sk)
                outliers.push({
                    identifier: sk,
                    tropeFunction: outlier.tropeFunction,
                })
            }
        }
        combinedCandidates.push({
            candidateId: candidate.candidateId,
            executionSummary: candidate.executionSummary,
            tropeAssignments,
            outliers,
        })
    }

    return {
        ok: true,
        combined: {
            candidates: combinedCandidates,
        },
    }
}

/** Deterministic Markdown for Stage Two dynamic tail (combined-only contract). */
export function renderCombinedHypothesisForStageTwo(
    combined: CombineHypothesisClustersReturn,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)

    const lines: string[] = ['## Combined clustering', '']

    for (const candidate of combined.candidates) {
        lines.push(`### Candidate ${candidate.candidateId}`, '')
        lines.push(`- **executionSummary:** ${candidate.executionSummary}`, '')
        for (const assignment of candidate.tropeAssignments) {
            lines.push(`#### ${assignment.trope}`, '')
            lines.push(`- **executionDetail:** ${assignment.executionDetail}`, '')
            for (const mem of assignment.members) {
                const sk = mem.identifier.trim()
                const obj = sk ? byStableKey.get(sk) : undefined
                const shortName = obj?.shortName ?? sk
                const roomLabel = obj
                    ? findRoomIdForObject(roomObjectsByRoom, obj)?.replace(/^ROOM#/, '') ?? ''
                    : ''
                lines.push(
                    `- **stableKey:** ${sk} — **shortName:** ${shortName}${roomLabel ? ` — **room:** ${roomLabel}` : ''}`
                )
                lines.push(`  - **tropeFunction:** ${mem.tropeFunction}`)
            }
            lines.push('')
        }
        lines.push('#### Outliers', '')
        if (candidate.outliers.length === 0) {
            lines.push('(none)', '')
        } else {
            for (const out of candidate.outliers) {
                const sk = out.identifier.trim()
                const obj = sk ? byStableKey.get(sk) : undefined
                const shortName = obj?.shortName ?? sk
                const roomLabel = obj
                    ? findRoomIdForObject(roomObjectsByRoom, obj)?.replace(/^ROOM#/, '') ?? ''
                    : ''
                lines.push(
                    `- **stableKey:** ${sk} — **shortName:** ${shortName}${roomLabel ? ` — **room:** ${roomLabel}` : ''}`
                )
                lines.push(`  - **tropeFunction:** ${out.tropeFunction}`)
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

function enrichMemberForPlanSelectJson(
    mem: CombinedMemberPair,
    byStableKey: Map<string, EphemeraMetaRoomObject>,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): { stableKey: string; shortName: string; room: string; tropeFunction: string } {
    const sk = mem.identifier.trim()
    const obj = sk ? byStableKey.get(sk) : undefined
    const shortName = obj?.shortName ?? sk
    const roomLabel = obj
        ? findRoomIdForObject(roomObjectsByRoom, obj)?.replace(/^ROOM#/, '') ?? ''
        : ''
    return {
        stableKey: sk,
        shortName,
        room: roomLabel,
        tropeFunction: mem.tropeFunction,
    }
}

/**
 * Deterministic JSON string for plan-selection prompts: same facts as
 * {@link renderCombinedHypothesisForStageTwo} with `stableKey` / `shortName` / `room` on each staged prop.
 * Callers typically wrap the result in a Markdown ` ```json ` fence.
 */
export function serializePlanSelectCombinedInput(
    combined: CombineHypothesisClustersReturn,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)
    const payload: {
        schemaVersion: number
        candidates: Array<{
            candidateId: string
            executionSummary: string
            tropeAssignments: Array<{
                trope: CoyoteTrope
                executionDetail: string
                members: ReturnType<typeof enrichMemberForPlanSelectJson>[]
            }>
            outliers: ReturnType<typeof enrichMemberForPlanSelectJson>[]
        }>
    } = {
        schemaVersion: 1,
        candidates: combined.candidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            executionSummary: candidate.executionSummary,
            tropeAssignments: candidate.tropeAssignments.map((assignment) => ({
                trope: assignment.trope,
                executionDetail: assignment.executionDetail,
                members: assignment.members.map((m) => enrichMemberForPlanSelectJson(m, byStableKey, roomObjectsByRoom)),
            })),
            outliers: candidate.outliers.map((o) => enrichMemberForPlanSelectJson(o, byStableKey, roomObjectsByRoom)),
        })),
    }
    return JSON.stringify(payload)
}
