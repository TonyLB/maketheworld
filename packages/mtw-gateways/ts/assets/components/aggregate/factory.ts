import { mergeAuthoritativeAcrossParticipationOrder } from './assemble'
import type { AggregatePerspective } from './input'
import { participationAssetsInPerspective } from './input'
import type { AggregateGatewayDeps, ComponentAggregateInternalCacheSlice } from './ports'
import { mergedComponentResult, type MergedComponentResult } from './result'

import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'

/**
 * Component aggregate gateway (compute-only). Injected loaders supply vertical and
 * authoritative component data; assembly methods will close over {@link AggregateGatewayDeps}.
 */
export type AggregateGateway = {
    participationAssetsInPerspective: (p: AggregatePerspective) => ReadonlySet<AssetUUID>
    assembleMergedComponent: (p: AggregatePerspective) => Promise<MergedComponentResult>
}

/**
 * Primary factory output: extensible bundle (e.g. future DeferredCache wiring for
 * `ComponentAggregate` on lambdas) without changing the `gateway` field shape.
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
            const merged = mergeAuthoritativeAcrossParticipationOrder(perspective, authoritative)
            return mergedComponentResult({
                universalKey,
                merged,
                mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
            })
        },
    }
}

/**
 * Blessed composition path: same loader contracts as assets `internalCache.ComponentData`
 * and `internalCache.ComponentVerticals`, under those property names.
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

/** Analyzer-shaped deps; equivalent to {@link createComponentAggregateGateway} with mapped field names. */
export function createAggregateGateway(deps: AggregateGatewayDeps): AggregateGateway {
    return aggregateGatewayFromDeps(deps)
}
