import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

import type { ImportVerticalHop } from '../verticals/fetch'
import {
    salvageImportVerticalHops,
    type RawImportVerticalHop,
} from '../verticals/consistency/salvage'

import { normalizeMergeParticipationOrder, type MergeParticipationOrder } from './input'

const normalizeAssetId = (assetId: string): AssetUUID => AssetKey(assetId) as AssetUUID

const hopsToRaw = (hops: ImportVerticalHop[]): RawImportVerticalHop[] =>
    hops.map(({ parentAssetId, childAssetId }) => ({
        parentAssetId: normalizeAssetId(parentAssetId),
        childAssetId: normalizeAssetId(childAssetId),
    }))

const compareAssetIds = (a: AssetUUID, b: AssetUUID): number => a.localeCompare(b)

/**
 * Derives merge participation order from import vertical hops: DFS preorder on the import forest,
 * children and roots visited in ascending AssetUUID order (see component aggregate planning).
 */
export function mergeParticipationOrderFromImportVerticalHops(
    hops: ImportVerticalHop[]
): MergeParticipationOrder {
    const salvaged = salvageImportVerticalHops(hopsToRaw(hops))
    if (salvaged.length === 0) {
        return Object.freeze([]) as MergeParticipationOrder
    }

    const childrenByParent = new Map<AssetUUID, AssetUUID[]>()
    const childNodes = new Set<AssetUUID>()
    const allNodes = new Set<AssetUUID>()

    for (const hop of salvaged) {
        const parent = normalizeAssetId(hop.parentAssetId)
        const child = normalizeAssetId(hop.childAssetId)
        allNodes.add(parent)
        allNodes.add(child)
        childNodes.add(child)
        const siblings = childrenByParent.get(parent) ?? []
        siblings.push(child)
        childrenByParent.set(parent, siblings)
    }

    for (const [parent, children] of childrenByParent.entries()) {
        childrenByParent.set(parent, [...children].sort(compareAssetIds))
    }

    const roots = [...allNodes]
        .filter((node) => !childNodes.has(node))
        .sort(compareAssetIds)

    const ordered: AssetUUID[] = []
    const visited = new Set<AssetUUID>()

    const visit = (node: AssetUUID): void => {
        if (visited.has(node)) {
            return
        }
        visited.add(node)
        ordered.push(node)
        for (const child of childrenByParent.get(node) ?? []) {
            visit(child)
        }
    }

    for (const root of roots) {
        visit(root)
    }

    return normalizeMergeParticipationOrder(ordered)
}
