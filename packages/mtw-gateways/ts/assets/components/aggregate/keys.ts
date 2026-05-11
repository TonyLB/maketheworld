import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import type { AggregatePerspective } from './input'

/**
 * Stable `DeferredCache` key for merged component assembly at a perspective.
 *
 * Uses the same ordered-stack encoding as ephemera routing (`computePerspectiveKey` on the merge
 * participation order) prefixed by `universalKey`, mirroring `${componentId}::${perspectiveKey}`.
 *
 * **`anchorAssetId`** is intentionally omitted until merge assembly consumes it; perspectives that
 * differ only by anchor share one cache entry today.
 */
export function aggregatePerspectiveCacheKey(p: AggregatePerspective): string {
    const perspectiveKey = computePerspectiveKey([...p.mergeParticipationOrder])
    return `${p.universalKey}::${perspectiveKey}`
}
