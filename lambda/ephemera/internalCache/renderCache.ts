/**
 * Request-scoped memo of render-cache Dynamo rows via mtw-gateways RenderCacheCacheHandler.
 * Ephemera-only compose: getExactMatch.
 */
import {
    createRenderCacheCacheHandler,
    isAuthoritativeCacheRow,
    markStatesEqual,
    RenderCacheCacheHandler,
    type EphemeraCacheComponentId,
    type EphemeraCacheDynamoItem,
    type EphemeraCacheMarkState,
    type RenderCacheSetParams,
    type RenderCacheSetCatalogRowParams,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { computePerspectiveKey, perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

export type { RenderCacheSetParams, RenderCacheSetCatalogRowParams }

export type RenderCacheGetExactMatchParams = {
    componentId: EphemeraCacheComponentId;
    proposedMarkState: EphemeraCacheMarkState;
    perspective: Perspective;
}

export class RenderCacheData extends RenderCacheCacheHandler {
    constructor() {
        super(ephemeraDB)
    }

    /**
     * Component-scoped exact-match lookup:
     * - memoized Dynamo rows via getCacheRows(componentId)
     * - filter candidates by matcher-based perspective rules
     * - match by Mark-state equality semantics
     */
    async getExactMatch(params: RenderCacheGetExactMatchParams): Promise<EphemeraCacheDynamoItem | null> {
        const { componentId, proposedMarkState, perspective } = params
        const rows = await this.getCacheRows(componentId)
        const perspectiveKey = computePerspectiveKey(perspective.assetStack)
        const catalog = await this.getCatalogRow(componentId, perspectiveKey)

        const versionFiltered = catalog !== undefined
            ? rows.filter((record) => isAuthoritativeCacheRow(record, catalog))
            : rows

        return (
            versionFiltered
                .filter((record) => record.perspectiveMatcher && perspectiveMatches(record.perspectiveMatcher, perspective))
                .filter((record) => markStatesEqual(proposedMarkState, record.markState))[0] ?? null
        )
    }
}

export const createRenderCacheData = (): RenderCacheData => new RenderCacheData()

/** @deprecated Prefer RenderCacheData; factory alias for package parity. */
export { createRenderCacheCacheHandler, RenderCacheCacheHandler }
