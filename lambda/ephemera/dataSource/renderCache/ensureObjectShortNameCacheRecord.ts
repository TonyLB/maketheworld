import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { IMPROVISATION_ASSET_ID, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import internalCache from '../../internalCache'
import { shortNameFromComponent, shortNameFromMergedAggregate } from '../objects/objectShortName'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from './baseClasses'
import type { EnsureAuthoredCatalogDependencies, EnsureAuthoredCatalogParams } from './ensureAuthoredCatalog'
import { putCacheRecord } from './putCacheRecord'

/**
 * Object description stub (see `AGENT.perceptionKernel.planning.md`, PK-6): drops into
 * `orchestrateRenderRequest`'s injectable `ensureAuthoredCatalog` slot for Object componentIds,
 * standing in for the real `ensureAuthoredCatalog` --- which is built for a different problem
 * (WML-authored content that changes when asset blueprints change, tracked via `catalogVersion`
 * and a gateway `AuthoredExampleSet` pull). Object has neither: no authoring surface, no blueprint
 * epoch. This always (re)writes exactly one CACHE# row per `(objectId, perspectiveKey)` from the
 * object's current merged `shortName`, cheap enough that there is no staleness concept worth
 * tracking. `findRender`'s ordinary exact-match logic (unmodified) then finds this row on the very
 * next step, resolving to a genuine `Exact Match Found` -> `Render Pertains`, never
 * `Generation Deferred`.
 *
 * Matches `ensureAuthoredCatalog`'s call signature exactly so it is a drop-in replacement, not a
 * fork of `orchestrateRenderRequest`/`findRender`.
 */
export async function ensureObjectShortNameCacheRecord(
    params: EnsureAuthoredCatalogParams,
    _deps: EnsureAuthoredCatalogDependencies = {}
): Promise<void> {
    const { componentId, perspective } = params
    if (!isEphemeraObjectId(componentId)) {
        throw new Error(`ensureObjectShortNameCacheRecord: componentId is not an Object id (${componentId})`)
    }

    let shortName = await shortNameFromMergedAggregate(
        componentId,
        perspective.assetStack,
        { getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives) }
    )
    if (!shortName) {
        const pairRow = await internalCache.ImprovisationComponentData.get(componentId, IMPROVISATION_ASSET_ID)
        shortName = shortNameFromComponent(pairRow?.component)
    }
    if (!shortName) {
        throw new Error(`ensureObjectShortNameCacheRecord: could not resolve a shortName for ${componentId}`)
    }

    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    const markState = { markValue: [] }
    // Overwrite any prior row for this (componentId, perspective) in place rather than accumulating
    // a fresh CACHE# row on every look --- there is no staleness concept here, only "always current."
    const existing = await internalCache.RenderCache.getExactMatch({
        componentId,
        proposedMarkState: markState,
        perspective,
    })
    await putCacheRecord(
        componentId,
        {
            markState,
            renderedContent: { displayName: [shortName], description: [] },
            provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
            perspectiveId: perspectiveKey,
            perspectiveMatcher: {
                requiredAssetIds: [...perspective.assetStack] as AssetUUID[],
                forbiddenAssetIds: [],
            },
        },
        existing?.DataCategory
    )
}
