import type { AggregatePerspective } from './input'
import { participationAssetsInPerspective } from './input'
import type { AggregateGatewayDeps } from './ports'

import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * Component aggregate gateway (compute-only). Injected loaders supply vertical and
 * authoritative component data; assembly methods will close over {@link AggregateGatewayDeps}.
 */
export type AggregateGateway = {
    participationAssetsInPerspective: (p: AggregatePerspective) => ReadonlySet<AssetUUID>
}

export function createAggregateGateway(deps: AggregateGatewayDeps): AggregateGateway {
    void deps
    return {
        participationAssetsInPerspective,
    }
}
