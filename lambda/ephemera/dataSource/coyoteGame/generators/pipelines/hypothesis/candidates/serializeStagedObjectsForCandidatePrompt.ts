import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

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

function isUnassignedForDecisionFocus(o: EphemeraMetaRoomObject): boolean {
    if (o.tropeAffinitiesFailed === true) {
        return true
    }
    if (!o.tropeAffinities || o.tropeAffinities.length === 0) {
        return true
    }
    return false
}

function isAmbiguousForDecisionFocus(o: EphemeraMetaRoomObject): boolean {
    if (o.tropeAffinitiesFailed === true) {
        return false
    }
    return Boolean(o.tropeAffinities && o.tropeAffinities.length >= 2)
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

    const ambiguousStableKeys: string[] = []
    const unassignedStableKeys: string[] = []
    for (const { o } of flat) {
        const sk = o.stableKey.trim()
        if (isAmbiguousForDecisionFocus(o)) {
            ambiguousStableKeys.push(sk)
        }
        if (isUnassignedForDecisionFocus(o)) {
            unassignedStableKeys.push(sk)
        }
    }
    ambiguousStableKeys.sort((a, b) => a.localeCompare(b))
    unassignedStableKeys.sort((a, b) => a.localeCompare(b))

    const payload = {
        decisionFocus: {
            ambiguousStableKeys,
            unassignedStableKeys,
        },
        objects,
    }
    return JSON.stringify(payload, null, 2)
}
