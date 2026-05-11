import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * Total merge order for a perspective: fold `StandardComponent.merge` in this sequence.
 * This is not necessarily a single root-to-leaf chain in the import graph.
 */
export type MergeParticipationOrder = readonly AssetUUID[]

/**
 * Task-plan name for {@link MergeParticipationOrder}; same type, grep-friendly alias.
 */
export type OrderedAssetStack = MergeParticipationOrder

export type AggregatePerspective = {
    readonly universalKey: EphemeraId
    readonly mergeParticipationOrder: MergeParticipationOrder
    /**
     * Reserved for FetchImports-style helpers that derive participation order from an anchor.
     * Unused until the assembly milestone documents behavior.
     */
    readonly anchorAssetId?: AssetUUID
}

export class AggregateInputError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'AggregateInputError'
    }
}

/**
 * Validates each id is a schema `AssetUUID` and rejects **duplicates** (strict) so merge
 * semantics and goldens never depend on implicit dedupe order.
 */
export function normalizeMergeParticipationOrder(ids: readonly AssetUUID[]): MergeParticipationOrder {
    const seen = new Set<string>()
    for (const id of ids) {
        if (!isSchemaAssetUUID(id)) {
            throw new AggregateInputError(`Invalid AssetUUID in merge participation order: ${String(id)}`)
        }
        if (seen.has(id)) {
            throw new AggregateInputError(`Duplicate asset id in merge participation order: ${id}`)
        }
        seen.add(id)
    }
    return Object.freeze(ids.slice()) as MergeParticipationOrder
}

export type AggregatePerspectiveExplicitArgs = {
    universalKey: string
    mergeParticipationOrder: readonly AssetUUID[]
    anchorAssetId?: AssetUUID
}

/**
 * Builds a validated {@link AggregatePerspective} from caller-supplied participation order.
 */
export function aggregatePerspectiveExplicit(args: AggregatePerspectiveExplicitArgs): AggregatePerspective {
    if (!isEphemeraId(args.universalKey)) {
        throw new AggregateInputError(`Invalid universalKey (expected EphemeraId): ${String(args.universalKey)}`)
    }
    if (args.anchorAssetId !== undefined && !isSchemaAssetUUID(args.anchorAssetId)) {
        throw new AggregateInputError(`Invalid anchorAssetId: ${String(args.anchorAssetId)}`)
    }
    const mergeParticipationOrder = normalizeMergeParticipationOrder(args.mergeParticipationOrder)
    const base = {
        universalKey: args.universalKey,
        mergeParticipationOrder,
    }
    if (args.anchorAssetId !== undefined) {
        return Object.freeze({
            ...base,
            anchorAssetId: args.anchorAssetId,
        })
    }
    return Object.freeze(base)
}

export function participationAssetsInPerspective(p: AggregatePerspective): ReadonlySet<AssetUUID> {
    return new Set(p.mergeParticipationOrder)
}
