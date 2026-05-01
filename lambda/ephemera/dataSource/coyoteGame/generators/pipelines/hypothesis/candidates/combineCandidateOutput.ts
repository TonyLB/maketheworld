import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

import type { ParsedCandidate } from './parseCandidateOutput'
import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'
import { seamRoomLabelFromEphemeraRoomId } from '../coyoteHypothesisPromptShared'

export type CombinedMemberPair = {
    identifier: string
    tropeFunction: string
}

/** Staged stableKey not placed under any trope row (identity only; derived multiset complement). */
export type CombinedOutlierIdentity = {
    identifier: string
}

export type CombinedTropeAssignment = {
    executionDetail: string
    members: CombinedMemberPair[]
}

export type CombinedTropeCandidate = {
    candidateId: string
    executionSummary: string
    tropeAssignments: Partial<Record<CoyoteTrope, CombinedTropeAssignment>>
    outliers: CombinedOutlierIdentity[]
}

export type CombineCandidateOutputReturn = {
    candidates: CombinedTropeCandidate[]
}

export type PlanSelectCombinedMember = {
    stableKey: string
    shortName: string
    room: string
    tropeFunction: string
}

export type PlanSelectCombinedOutlier = {
    stableKey: string
    shortName: string
    room: string
}

export type PlanSelectCombinedTropeAssignment = {
    executionDetail: string
    members: PlanSelectCombinedMember[]
}

export type PlanSelectCombinedCandidate = {
    candidateId: string
    executionSummary: string
    tropeAssignments: Partial<Record<CoyoteTrope, PlanSelectCombinedTropeAssignment>>
    outliers: PlanSelectCombinedOutlier[]
}

export type CombineCandidateOutputSuccess = {
    ok: true
    combined: CombineCandidateOutputReturn
}

export type CombineCandidateOutputFailure = {
    ok: false
    errorMessage: string
}

export type CombineCandidateOutputResult = CombineCandidateOutputSuccess | CombineCandidateOutputFailure
const TROPE_ORDER: CoyoteTrope[] = ['Contraption', 'Distraction', 'Disadvantage', 'Finishing Move']

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

/** One entry per staged object, in room iteration order, for multiset complement. */
function stagedStableKeysInOrder(roomObjectsByRoom: CoyoteRoomObjectsByRoom): string[] {
    const keys: string[] = []
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            keys.push(o.stableKey.trim())
        }
    }
    return keys
}

function deriveOutlierIdentifiers(
    stagedOrdered: string[],
    assignmentStableKeys: string[]
): { ok: true; identifiers: string[] } | { ok: false; errorMessage: string } {
    const remaining = new Map<string, number>()
    for (const k of stagedOrdered) {
        remaining.set(k, (remaining.get(k) ?? 0) + 1)
    }
    for (const ak of assignmentStableKeys) {
        const c = (remaining.get(ak) ?? 0) - 1
        if (c < 0) {
            return {
                ok: false,
                errorMessage: `combine: assignment over-uses stableKey "${ak}" vs staged multiset`,
            }
        }
        remaining.set(ak, c)
    }
    const identifiers: string[] = []
    for (const k of stagedOrdered) {
        const c = remaining.get(k) ?? 0
        if (c > 0) {
            identifiers.push(k)
            remaining.set(k, c - 1)
        }
    }
    return { ok: true, identifiers }
}

/**
 * Hydrates trope assignments and **derives** candidate-local outliers as the multiset complement:
 * staged `stableKey`s minus keys appearing in **`tropeAssignments[*].members`** (order follows staged snapshot iteration).
 */
export function combineCandidateOutput(
    candidates: ParsedCandidate[],
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): CombineCandidateOutputResult {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)
    const stagedOrdered = stagedStableKeysInOrder(roomObjectsByRoom)
    const combinedCandidates: CombinedTropeCandidate[] = []
    for (const candidate of candidates) {
        const seenKeys = new Set<string>()
        const tropeAssignments: Partial<Record<CoyoteTrope, CombinedTropeAssignment>> = {}
        const assignmentStableKeys: string[] = []
        for (const trope of TROPE_ORDER) {
            const tropeAssignment = candidate.tropeAssignments[trope]
            if (!tropeAssignment) {
                continue
            }
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
                assignmentStableKeys.push(sk)
                membersOut.push({
                    identifier: sk,
                    tropeFunction: mem.tropeFunction,
                })
            }
            tropeAssignments[trope] = {
                executionDetail: tropeAssignment.executionDetail,
                members: membersOut,
            }
        }
        const derived = deriveOutlierIdentifiers(stagedOrdered, assignmentStableKeys)
        if (!derived.ok) {
            return { ok: false, errorMessage: derived.errorMessage }
        }
        const outliers: CombinedOutlierIdentity[] = derived.identifiers.map((identifier) => ({ identifier }))
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

/** Deterministic Markdown for the narrative-beat prompt dynamic tail (combined-only contract). */
export function renderCombinedCandidateOutputForNarrativeBeat(
    combined: CombineCandidateOutputReturn,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)

    const lines: string[] = ['## Combined clustering', '']

    for (const candidate of combined.candidates) {
        lines.push(`### Candidate ${candidate.candidateId}`, '')
        lines.push(`- **executionSummary:** ${candidate.executionSummary}`, '')
        for (const trope of TROPE_ORDER) {
            const assignment = candidate.tropeAssignments[trope]
            if (!assignment) {
                continue
            }
            lines.push(`#### ${trope}`, '')
            lines.push(`- **executionDetail:** ${assignment.executionDetail}`, '')
            for (const mem of assignment.members) {
                const sk = mem.identifier.trim()
                const obj = sk ? byStableKey.get(sk) : undefined
                const shortName = obj?.shortName ?? sk
                const roomIdForObj = obj ? findRoomIdForObject(roomObjectsByRoom, obj) : undefined
                const roomLabel = roomIdForObj !== undefined ? seamRoomLabelFromEphemeraRoomId(roomIdForObj) : ''
                lines.push(
                    `- **stableKey:** ${sk} -- **shortName:** ${shortName}${roomLabel ? ` -- **room:** ${roomLabel}` : ''}`
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
                const roomIdForObj = obj ? findRoomIdForObject(roomObjectsByRoom, obj) : undefined
                const roomLabel = roomIdForObj !== undefined ? seamRoomLabelFromEphemeraRoomId(roomIdForObj) : ''
                lines.push(
                    `- **stableKey:** ${sk} -- **shortName:** ${shortName}${roomLabel ? ` -- **room:** ${roomLabel}` : ''}`
                )
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
): PlanSelectCombinedMember {
    const sk = mem.identifier.trim()
    const obj = sk ? byStableKey.get(sk) : undefined
    const shortName = obj?.shortName ?? sk
    const roomIdForObj = obj ? findRoomIdForObject(roomObjectsByRoom, obj) : undefined
    const roomLabel = roomIdForObj !== undefined ? seamRoomLabelFromEphemeraRoomId(roomIdForObj) : ''
    return {
        stableKey: sk,
        shortName,
        room: roomLabel,
        tropeFunction: mem.tropeFunction,
    }
}

function enrichOutlierForPlanSelectJson(
    out: CombinedOutlierIdentity,
    byStableKey: Map<string, EphemeraMetaRoomObject>,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): PlanSelectCombinedOutlier {
    const sk = out.identifier.trim()
    const obj = sk ? byStableKey.get(sk) : undefined
    const shortName = obj?.shortName ?? sk
    const roomIdForObj = obj ? findRoomIdForObject(roomObjectsByRoom, obj) : undefined
    const roomLabel = roomIdForObj !== undefined ? seamRoomLabelFromEphemeraRoomId(roomIdForObj) : ''
    return {
        stableKey: sk,
        shortName,
        room: roomLabel,
    }
}

/**
 * Deterministic JSON string for plan-selection prompts: same facts as
 * {@link renderCombinedCandidateOutputForNarrativeBeat} with `stableKey` / `shortName` / `room` on each staged prop.
 * Callers typically wrap the result in a Markdown ` ```json ` fence.
 */
export function serializePlanSelectCandidateInput(
    combined: CombineCandidateOutputReturn,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)
    const payload: {
        schemaVersion: number
        candidates: PlanSelectCombinedCandidate[]
    } = {
        schemaVersion: 3,
        candidates: combined.candidates.map((candidate) => {
            const tropeAssignments: Partial<Record<CoyoteTrope, PlanSelectCombinedTropeAssignment>> = {}
            for (const trope of TROPE_ORDER) {
                const assignment = candidate.tropeAssignments[trope]
                if (!assignment) {
                    continue
                }
                tropeAssignments[trope] = {
                    executionDetail: assignment.executionDetail,
                    members: assignment.members.map((m) => enrichMemberForPlanSelectJson(m, byStableKey, roomObjectsByRoom)),
                }
            }
            return {
                candidateId: candidate.candidateId,
                executionSummary: candidate.executionSummary,
                tropeAssignments,
                outliers: candidate.outliers.map((o) => enrichOutlierForPlanSelectJson(o, byStableKey, roomObjectsByRoom)),
            }
        }),
    }
    return JSON.stringify(payload)
}

/** Enriched outlier rows for a combined candidate (e.g. planSelect output rehydrate from combine). */
export function planSelectOutliersForCandidate(
    candidate: CombinedTropeCandidate,
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): PlanSelectCombinedOutlier[] {
    const byStableKey = snapshotIndexByStableKey(roomObjectsByRoom)
    return candidate.outliers.map((o) => enrichOutlierForPlanSelectJson(o, byStableKey, roomObjectsByRoom))
}
