import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import internalCache from '../../internalCache'

export type InvalidateImprovisationObjectCachesArgs = {
    objectId: EphemeraObjectId;
    affectedRoomIds?: EphemeraRoomId[];
    /** When set, memo-patch pair cache instead of invalidate (spawn path). */
    pairComponent?: StandardComponent;
    /** When set, memo-patch meta cache instead of invalidate (spawn path). */
    metaRow?: EphemeraMetaObject;
    /** When set, memo-patch object embedding cache after a successful write. */
    embedding?: SemanticEmbedding;
    /** When true, drop object embedding memo (delete, spawn without row, stale after failed re-embed). */
    clearEmbedding?: boolean;
}

/**
 * Post-write cache contract for improvisation object persistence.
 * Pair body: ImprovisationComponentData; play meta: ObjectEphemeraMeta; embedding: ObjectEmbedding;
 * per affected room: AffordanceRoomDeliverable only.
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

    if (args.embedding) {
        internalCache.ObjectEmbedding.set(args.objectId, args.embedding)
    }
    else if (args.clearEmbedding) {
        internalCache.ObjectEmbedding.invalidate(args.objectId)
    }

    // Only the room deliverable embeds object prose (shortName). These writes touch no `Meta::Room`
    // row and no graph, so `ComponentEphemeraMeta` and `Positions` stay valid --- and the room's
    // graph memo was just seeded by the placement/removal commit that precedes a spawn's place or
    // a delete; invalidating it would discard that write-through for an eventually-consistent re-read.
    for (const roomId of args.affectedRoomIds ?? []) {
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
    }
}
