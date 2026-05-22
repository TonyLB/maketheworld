import type { AggregatePerspective } from './input'
import { participationAssetsInPerspective } from './input'
import { mergedComponentFromAuthoritative } from './factory'
import type {
    AggregateParticipationAssemblyDeps,
    ComponentAggregateInternalCacheSlice,
} from './ports'

import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { MergedComponentResult } from './result'
import { authoritativeFromParticipationOrder } from '../componentData/participationBatch'

/**
 * Uncached aggregate gateway (compute-only). Injected loaders supply vertical and
 * participation-scoped component data; assembly methods close over
 * {@link AggregateParticipationAssemblyDeps}.
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

function aggregateGatewayFromDeps(deps: AggregateParticipationAssemblyDeps): AggregateGateway {
    return {
        participationAssetsInPerspective,
        assembleMergedComponent: async (perspective) => {
            const universalKey = perspective.universalKey
            const [metaResult, authoritative] = await Promise.all([
                deps.metaImportProjection.get([universalKey]),
                authoritativeFromParticipationOrder(
                    universalKey as ComponentUUID,
                    perspective.mergeParticipationOrder,
                    deps.authoritativeComponentData
                ),
            ])
            void metaResult
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
 * {@link AggregateParticipationAssemblyDeps} / analyzer field names (`authoritativeComponentData`,
 * `metaImportProjection`). Prefer {@link createComponentAggregateCacheHandler} for runtime merge
 * reads; see `packages/mtw-gateways/AGENT.md` (Aggregate read surfaces).
 */
export function createAggregateGateway(deps: AggregateParticipationAssemblyDeps): AggregateGateway {
    return aggregateGatewayFromDeps(deps)
}
