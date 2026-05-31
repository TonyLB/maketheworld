/**
 * TopologyInvalidated handler: room-scoped catalog bumps only (no hydrate on receive).
 */
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ComponentTopologyInvalidatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentTopology'
import {
    isAreaScopedTopologyInvalidated,
    isRoomScopedTopologyInvalidated,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentTopology'

import { catalogRowMatchesEditAssetId } from './catalogGuards'
import {
    conditionalInvalidateAffordanceRow,
    queryAffordanceRowsForRoom,
} from './catalogRow'

const asRoomId = (id: ComponentUUID): EphemeraRoomId | undefined =>
    (isEphemeraRoomId(id) ? id : undefined)

const handleRoomScopedInvalidation = async (
    roomIds: readonly ComponentUUID[],
    editAssetId: ComponentTopologyInvalidatedEvent extends { editAssetId: infer A } ? A : never
): Promise<void> => {
    for (const roomIdRaw of roomIds) {
        const roomId = asRoomId(roomIdRaw)
        if (!roomId) {
            continue
        }
        const rows = await queryAffordanceRowsForRoom(roomId)
        const targets = rows.filter((row) => catalogRowMatchesEditAssetId(row, editAssetId))
        await Promise.all(targets.map((row) => conditionalInvalidateAffordanceRow(row)))
    }
}

export const handleTopologyInvalidated = async (
    event: ComponentTopologyInvalidatedEvent
): Promise<void> => {
    if (isAreaScopedTopologyInvalidated(event)) {
        return
    }
    if (isRoomScopedTopologyInvalidated(event)) {
        await handleRoomScopedInvalidation(event.roomIds, event.editAssetId)
    }
}
