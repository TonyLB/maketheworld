import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    isCausalCoyoteTrope,
    type CoyoteTropeAffinity,
    type CoyoteTropeAptness,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'
import { seamRoomLabelFromEphemeraRoomId } from '../coyoteHypothesisPromptShared'

/**
 * Flattens staged objects from all rooms, then sorts globally by `stableKey` (lexicographic on trim)
 * so prompt JSON is stable across runs and tests. Room is a per-row seam label, not a grouping key.
 */
function sortedRoomEntries(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): [EphemeraRoomId, EphemeraMetaRoomObject[]][] {
    return (Object.entries(roomObjectsByRoom) as [EphemeraRoomId, EphemeraMetaRoomObject[]][]).sort(
        ([a], [b]) => (a as string).localeCompare(b as string)
    )
}

function objectRowForSnapshot(o: EphemeraMetaRoomObject, roomLabel: string): Record<string, unknown> {
    return {
        uuid: o.uuid,
        shortName: o.shortName,
        stableKey: o.stableKey,
        room: roomLabel,
        ...(o.tropeAffinities !== undefined ? { tropeAffinities: o.tropeAffinities } : {}),
        ...(o.tropeAffinitiesFailed !== undefined ? { tropeAffinitiesFailed: o.tropeAffinitiesFailed } : {}),
    }
}

function isAffinityEligibleForDecisionFocus(o: EphemeraMetaRoomObject): boolean {
    if (o.tropeAffinitiesFailed === true) {
        return false
    }
    return Boolean(o.tropeAffinities && o.tropeAffinities.length > 0)
}

function isNonPoorAptness(a: CoyoteTropeAptness): boolean {
    return a === 'High' || a === 'Good'
}

function rowHasNonEmptyAffordanceArrays(row: CoyoteTropeAffinity): boolean {
    return (row.environmentAffordances?.length ?? 0) > 0 || (row.affordancesProvided?.length ?? 0) > 0
}

/** Affordances on Poor rows are ignored for anchor/expander bucketing. */
function rowHasNonPoorAffordances(row: CoyoteTropeAffinity): boolean {
    return row.aptness !== 'Poor' && rowHasNonEmptyAffordanceArrays(row)
}

function nonPoorRows(rows: CoyoteTropeAffinity[]): CoyoteTropeAffinity[] {
    return rows.filter((r) => isNonPoorAptness(r.aptness))
}

function hasNonPoorCausalAffinity(rows: CoyoteTropeAffinity[]): boolean {
    return nonPoorRows(rows).some((r) => isCausalCoyoteTrope(r.trope))
}

function hasNonPoorSceneDressingAffinity(rows: CoyoteTropeAffinity[]): boolean {
    return nonPoorRows(rows).some((r) => r.trope === 'Scene Dressing')
}

/** Scene Dressing only (no non-Poor causal fits): strong archetype expander signal. */
function isSceneDressingOnlyExpander(o: EphemeraMetaRoomObject): boolean {
    if (!isAffinityEligibleForDecisionFocus(o)) {
        return false
    }
    const rows = o.tropeAffinities!
    return hasNonPoorSceneDressingAffinity(rows) && !hasNonPoorCausalAffinity(rows)
}

function isExpanderForDecisionFocus(o: EphemeraMetaRoomObject): boolean {
    if (!isAffinityEligibleForDecisionFocus(o)) {
        return false
    }
    if (isSceneDressingOnlyExpander(o)) {
        return true
    }
    const rows = o.tropeAffinities!
    const nonPoorCount = nonPoorRows(rows).length
    if (nonPoorCount >= 2) {
        return true
    }
    return rows.some((r) => rowHasNonPoorAffordances(r))
}

function isAnchorForDecisionFocus(o: EphemeraMetaRoomObject): boolean {
    if (!isAffinityEligibleForDecisionFocus(o)) {
        return false
    }
    if (isExpanderForDecisionFocus(o)) {
        return false
    }
    const rows = o.tropeAffinities!
    const nonPoorRows = rows.filter((r) => isNonPoorAptness(r.aptness))
    if (nonPoorRows.length !== 1) {
        return false
    }
    const pole = nonPoorRows[0]
    if (pole.aptness !== 'High') {
        return false
    }
    return !rowHasNonEmptyAffordanceArrays(pole)
}

/**
 * Stage-one (candidates hop) JSON: one row per staged object, affinity-first, with optional
 * `decisionFocus` hints. No canonical `roomId` in the fence; `room` is the seam label only.
 */
export function serializeStagedObjectsAffinityForwardJson(roomObjectsByRoom: CoyoteRoomObjectsByRoom): string {
    const flat: Array<{ roomId: EphemeraRoomId; o: EphemeraMetaRoomObject }> = []
    for (const [roomId, objects] of sortedRoomEntries(roomObjectsByRoom)) {
        for (const o of objects) {
            flat.push({ roomId, o })
        }
    }
    flat.sort((a, b) => a.o.stableKey.trim().localeCompare(b.o.stableKey.trim()))

    const objects = flat.map(({ roomId, o }) =>
        objectRowForSnapshot(o, seamRoomLabelFromEphemeraRoomId(roomId))
    )

    const anchorStableKeys: string[] = []
    const expanderStableKeys: string[] = []
    for (const { o } of flat) {
        const sk = o.stableKey.trim()
        if (isAnchorForDecisionFocus(o)) {
            anchorStableKeys.push(sk)
        }
        if (isExpanderForDecisionFocus(o)) {
            expanderStableKeys.push(sk)
        }
    }
    anchorStableKeys.sort((a, b) => a.localeCompare(b))
    expanderStableKeys.sort((a, b) => a.localeCompare(b))

    const payload = {
        decisionFocus: {
            anchorStableKeys,
            expanderStableKeys,
        },
        objects,
    }
    return JSON.stringify(payload, null, 2)
}
