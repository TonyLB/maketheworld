import { mergeAuthoritativeAcrossParticipationOrder } from './assemble'
import type { AggregatePerspective } from './input'
import { participationAssetsInPerspective } from './input'
import type { AggregateGatewayDeps } from './ports'
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

export function createAggregateGateway(deps: AggregateGatewayDeps): AggregateGateway {
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
