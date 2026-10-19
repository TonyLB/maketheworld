import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../internalCache'

type NodeLike = { isPresence?: boolean; ref?: number; universalKey?: string }

export type AuthoredNestingsDependencies = {
    /** The assets whose cache holds the component (`Meta::<Tag>.cached`). */
    cachedAssetsOf: (parentId: string) => Promise<string[]>
    /** Each asset's own `ludicGraph.nodes` list for the component, a per-asset diff delta. */
    nodesAcrossAssets: (parentId: string, assetIds: string[]) => Promise<NodeLike[][]>
}

const metaCategoryOf = (parentId: string): string | undefined => (
    isEphemeraRoomId(parentId) ? 'Meta::Room' : isEphemeraAreaId(parentId) ? 'Meta::Area' : isEphemeraFeatureId(parentId) ? 'Meta::Feature' : undefined
)

const defaultDependencies: AuthoredNestingsDependencies = {
    cachedAssetsOf: async (parentId) => {
        const dataCategory = metaCategoryOf(parentId)
        if (!dataCategory) {
            return []
        }
        const row = await assetDB.getItem<{ cached?: string[] }>({
            Key: { AssetId: parentId, DataCategory: dataCategory },
            ProjectionFields: ['cached'],
        })
        return row?.cached ?? []
    },
    nodesAcrossAssets: async (parentId, assetIds) => {
        const entries = await internalCache.ComponentData.getAcrossAssets(parentId as any, assetIds as any)
        return Object.values(entries).map((entry) => {
            const nodes = (entry.component as { ludicGraph?: { nodes?: { payload?: NodeLike[] } } }).ludicGraph?.nodes
            return nodes?.payload ?? []
        })
    },
}

/**
 * The nested children a parent's authored assets declare: the setpoint for fixed containment.
 * `Component Updated` carries each asset's component as a **diff**, so the per-asset
 * `ludicGraph.nodes` is a delta (added nodes `ref > 0`, removed nodes inverted to `ref < 0`) and
 * nothing resolves imports. The declared list is the union of the positive-ref component nodes
 * across every asset in `Meta::<Tag>.cached`, which is what population has written since each
 * asset cached. Presence nodes are the parent's own bindings, not children.
 * Ephemera's heal reads the same list (`lambda/ephemera/.../containment/authoredChildren.ts`);
 * keep the two definitions of "authored" in step.
 */
export const authoredChildrenOf = async (
    parentId: string,
    deps: AuthoredNestingsDependencies = defaultDependencies
): Promise<string[]> => {
    const assetIds = await deps.cachedAssetsOf(parentId)
    if (assetIds.length === 0) {
        return []
    }
    const nodeLists = await deps.nodesAcrossAssets(parentId, assetIds)
    return [...new Set(nodeLists.flatMap((nodes) => nodes.flatMap((node) => (
        !node.isPresence && typeof node.universalKey === 'string' && (node.ref ?? 1) > 0 ? [node.universalKey] : []
    ))))].sort()
}
