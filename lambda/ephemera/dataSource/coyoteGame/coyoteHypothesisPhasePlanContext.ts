import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    normalizedPhasePlanStableKey,
    type CoyotePhasePlanValidationContext,
} from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import { seamRoomLabelFromEphemeraRoomId } from './coyoteHypothesisPromptShared'
import type { CoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot'

/** Normalized snapshot **`stableKey`** set for **`validateCoyotePhasePlan`**. */
export function collectCoyoteSnapshotStableKeys(roomObjectsByRoom: CoyoteRoomObjectsByRoom): Set<string> {
    const out = new Set<string>()
    for (const objects of Object.values(roomObjectsByRoom)) {
        for (const o of objects) {
            out.add(normalizedPhasePlanStableKey(o.stableKey))
        }
    }
    return out
}

/** Seam room labels for rooms that have staged objects (topology refs in **`derivedFrom`**). */
export function coyoteTopologyAllowlistFromRooms(roomObjectsByRoom: CoyoteRoomObjectsByRoom): Set<string> {
    const out = new Set<string>()
    for (const roomId of Object.keys(roomObjectsByRoom) as EphemeraRoomId[]) {
        if ((roomObjectsByRoom[roomId] ?? []).length > 0) {
            out.add(seamRoomLabelFromEphemeraRoomId(roomId))
        }
    }
    return out
}

/** Builds validation context for hop-2 phase-plan JSON (snapshot keys + topology allowlist). */
export function buildCoyotePhasePlanValidationContext(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): CoyotePhasePlanValidationContext {
    return {
        snapshotStableKeys: collectCoyoteSnapshotStableKeys(roomObjectsByRoom),
        allowedTopologyRefTokens: coyoteTopologyAllowlistFromRooms(roomObjectsByRoom),
    }
}
