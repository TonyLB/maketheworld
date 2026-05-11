import type { AggregatePerspective } from './input'
import { participationAssetsInPerspective } from './input'
import { mergedComponentFromAuthoritative } from './factory'
import type { AggregateGatewayDeps, ComponentAggregateInternalCacheSlice } from './ports'

import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'
import type { MergedComponentResult } from './result'

/**
 * Uncached aggregate gateway (compute-only). Injected loaders supply vertical and
 * authoritative component data; assembly methods close over {@link AggregateGatewayDeps}.
 *
 * **Secondary** integration surface --- see `packages/mtw-gateways/AGENT.md` (Aggregate read surfaces).
 */
export type AggregateGateway = {
    participationAssetsInPerspective: (p: AggregatePerspective) => ReadonlySet<AssetUUID>
    assembleMergedComponent: (p: AggregatePerspective) => Promise<MergedComponentResult>
}

/**
 * Uncached gateway bundle ({@link createComponentAggregateGateway}). Prefer
 * {@link createComponentAggregateCacheHandler} from `./factory` for lambda/runtime wiring.
 */
export type ComponentAggregateGatewayBundle = {
    gateway: AggregateGateway
}

function aggregateGatewayFromDeps(deps: AggregateGatewayDeps): AggregateGateway {
    return {
        participationAssetsInPerspective,
        assembleMergedComponent: async (perspective) => {
            const universalKey = perspective.universalKey
            const [metaResult, authoritativeRows] = await Promise.all([
                deps.metaImportProjection.get([universalKey]),
                deps.authoritativeComponentData.get([universalKey]),
            ])
            void metaResult
            const authoritative: AuthoritativeComponentData =
                authoritativeRows[0] ?? ({ ComponentId: universalKey, byAssets: [] } satisfies AuthoritativeComponentData)
            return mergedComponentFromAuthoritative(perspective, authoritative)
        },
    }
}

/**
 * **Secondary** surface: returns an uncached {@link AggregateGateway} that calls sibling loaders
 * on each `assembleMergedComponent` (no aggregate `DeferredCache`). Same loader contracts as
 * assets `internalCache.ComponentData` / `ComponentVerticals` property names. Prefer
 * {@link createComponentAggregateCacheHandler} for production lambda integration; keep this for
 * tests, parity checks, and tooling. See `packages/mtw-gateways/AGENT.md` (Aggregate read surfaces).
 */
export function createComponentAggregateGateway(
    slice: ComponentAggregateInternalCacheSlice
): ComponentAggregateGatewayBundle {
    return {
        gateway: aggregateGatewayFromDeps({
            authoritativeComponentData: slice.ComponentData,
            metaImportProjection: slice.ComponentVerticals,
        }),
    }
}

/**
 * **Secondary** surface: same as {@link createComponentAggregateGateway} but with
 * {@link AggregateGatewayDeps} / analyzer field names (`authoritativeComponentData`,
 * `metaImportProjection`). Prefer {@link createComponentAggregateCacheHandler} for runtime merge
 * reads; see `packages/mtw-gateways/AGENT.md` (Aggregate read surfaces).
 */
export function createAggregateGateway(deps: AggregateGatewayDeps): AggregateGateway {
    return aggregateGatewayFromDeps(deps)
}
