import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { Graph } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph'
import type { GraphEdge } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph/baseClasses'
import topologicalSort from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph/topologicalSort'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { stripAssetIdForSortKey } from './keys'

export type RawImportVerticalHop = {
    parentAssetId: string
    childAssetId: string
}

type GraphNode = { key: string }

const normalizeHopEndpoints = (hop: RawImportVerticalHop): { from: string; to: string } => ({
    from: AssetKey(hop.parentAssetId) as string,
    to: AssetKey(hop.childAssetId) as string,
})

const hopSortKey = (hop: RawImportVerticalHop): [string, string] => {
    const { from, to } = normalizeHopEndpoints(hop)
    return [stripAssetIdForSortKey(from), stripAssetIdForSortKey(to)]
}

const compareHopSortKeys = (a: RawImportVerticalHop, b: RawImportVerticalHop): number => {
    const [ap, ac] = hopSortKey(a)
    const [bp, bc] = hopSortKey(b)
    const pc = ap.localeCompare(bp)
    return pc !== 0 ? pc : ac.localeCompare(bc)
}

const hopsEqual = (a: RawImportVerticalHop, b: RawImportVerticalHop): boolean =>
    compareHopSortKeys(a, b) === 0

/**
 * One authoritative import hop per (universal component, child asset): child inherits from parent via `_from`.
 */
export function deriveRawImportVerticalHopsFromComponents(
    rows: { childAssetId: string; component: StandardComponent }[]
): RawImportVerticalHop[] {
    const result: RawImportVerticalHop[] = []
    for (const { childAssetId, component } of rows) {
        if (!component._from) {
            continue
        }
        result.push({
            parentAssetId: AssetKey(component._from as string) as string,
            childAssetId: AssetKey(childAssetId) as string,
        })
    }
    return result
}

function buildNodeToComponent<K extends string>(strongComponents: K[][]): Map<K, K[]> {
    const map = new Map<K, K[]>()
    for (const comp of strongComponents) {
        for (const node of comp) {
            map.set(node, comp)
        }
    }
    return map
}

function buildImportGraph(hops: RawImportVerticalHop[]): Graph<string, GraphNode, Record<string, never>> {
    const nodes: Partial<Record<string, GraphNode>> = {}
    const edges: GraphEdge<string, Record<string, never>>[] = []
    for (const hop of hops) {
        const { from, to } = normalizeHopEndpoints(hop)
        nodes[from] = { key: from }
        nodes[to] = { key: to }
        edges.push({ from, to })
    }
    return new Graph<string, GraphNode, Record<string, never>>(nodes, edges, {}, true)
}

function isCyclicHop(
    hop: RawImportVerticalHop,
    nodeToComponent: Map<string, string[]>
): boolean {
    const { from, to } = normalizeHopEndpoints(hop)
    if (from === to) {
        return true
    }
    const compFrom = nodeToComponent.get(from)
    const compTo = nodeToComponent.get(to)
    if (!compFrom || !compTo || compFrom !== compTo) {
        return false
    }
    return compFrom.length > 1
}

/**
 * Deterministic index salvage: while the hop graph has directed cycles, remove one hop at a time using
 * minimum stripped parent id, tie-break stripped child (see verticals writer AGENT.md).
 */
export function salvageImportVerticalHops(initialHops: RawImportVerticalHop[]): RawImportVerticalHop[] {
    let hops = [...initialHops]
    const maxIterations = Math.max(hops.length, 1)
    for (let i = 0; i < maxIterations; i++) {
        if (hops.length === 0) {
            return []
        }
        const graph = buildImportGraph(hops)
        const strongComponents = topologicalSort(graph)
        const nodeToComponent = buildNodeToComponent(strongComponents)
        const cyclic = hops.filter((h) => isCyclicHop(h, nodeToComponent))
        if (cyclic.length === 0) {
            return hops
        }
        cyclic.sort(compareHopSortKeys)
        const toRemove = cyclic[0]
        const removeIndex = hops.findIndex((h) => hopsEqual(h, toRemove))
        if (removeIndex === -1) {
            return hops
        }
        hops = [...hops.slice(0, removeIndex), ...hops.slice(removeIndex + 1)]
    }
    return hops
}
