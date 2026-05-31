import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import type { AssembleRoomTopologyInput } from './input'

/**
 * Stable `DeferredCache` key for room topology assembly at a perspective.
 */
export function componentTopologyPerspectiveCacheKey(
    input: AssembleRoomTopologyInput
): string {
    const perspectiveKey = computePerspectiveKey([...input.mergeParticipationOrder])
    return `${input.roomUniversalKey}::${perspectiveKey}`
}
