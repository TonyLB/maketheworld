import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import internalCache from '../../internalCache'

export type InvalidateImprovisationObjectCachesArgs = {
    objectId: EphemeraObjectId;
    affectedRoomIds?: EphemeraRoomId[];
    /** When set, memo-patch pair cache instead of invalidate (spawn path). */
    pairComponent?: StandardComponent;
    /** When set, memo-patch meta cache instead of invalidate (spawn path). */
    metaRow?: EphemeraMetaObject;
}

/**
 * Post-write cache contract for improvisation object persistence.
 * Pair body: ImprovisationComponentData; play meta: ObjectEphemeraMeta.
 */
export const invalidateImprovisationObjectCaches = (args: InvalidateImprovisationObjectCachesArgs): void => {
    if (args.pairComponent) {
        internalCache.ImprovisationComponentData.set(args.objectId, IMPROVISATION_ASSET_ID, args.pairComponent)
    }
    else {
        internalCache.ImprovisationComponentData.invalidate(args.objectId, IMPROVISATION_ASSET_ID)
    }

    if (args.metaRow) {
        internalCache.ObjectEphemeraMeta.set(args.objectId, args.metaRow)
    }
    else {
        internalCache.ObjectEphemeraMeta.invalidate(args.objectId)
    }

    for (const roomId of args.affectedRoomIds ?? []) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.invalidate(roomId)
    }
}
