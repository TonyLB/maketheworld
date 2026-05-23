import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import {
    defaultResolveRoomLensMarkDefaults,
    type AssembleComponentExamplesInput,
} from './input'

/**
 * Stable `DeferredCache` key for authored-example assembly at a cache-host perspective.
 *
 * Includes effective `resolveRoomLensMarkDefaults` because Room lens merge affects output (A4).
 */
export function componentExamplesPerspectiveCacheKey(
    input: AssembleComponentExamplesInput
): string {
    const perspectiveKey = computePerspectiveKey([...input.mergeParticipationOrder])
    const resolveRoomLensMarkDefaults =
        input.options?.resolveRoomLensMarkDefaults ??
        defaultResolveRoomLensMarkDefaults(input.hostUniversalKey)
    const lensFlag = resolveRoomLensMarkDefaults ? '1' : '0'
    return `${input.hostUniversalKey}::${perspectiveKey}::lensDefaults=${lensFlag}`
}
