/**
 * Merge multiple origin chains (base-first asset UUID arrays) into a single
 * ordered list consistent with all chains, using topological sort.
 * Used when deriving perspective from Room + Situations + Marks origins.
 */

import { Graph } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * Merge origin chains into one base-first list. Each chain is [base, ..., leaf].
 * Uses topological sort of the combined graph. When the graph has cycles (e.g.
 * conflicting order across chains), Tarjan still returns SCCs in dependency order;
 * within each SCC we sort nodes by asset ID so the result is deterministic and
 * preserves partial order (e.g. fan-out then fan-in: A, B, C, D, E).
 */
export function mergeOriginChainsToOrderedAssets(originChains: AssetUUID[][]): AssetUUID[] {
    const chains = originChains.filter((chain) => Array.isArray(chain) && chain.length > 0)
    if (chains.length === 0) return []

    const { nodes, edges } = chains.reduce<{
        nodes: Partial<Record<string, { key: string }>>
        edges: { from: string; to: string }[]
    }>(
        (acc, chain) => {
            chain.forEach((id) => {
                acc.nodes[id] = { key: id }
            })
            acc.edges = chain.slice(0, -1).reduce(
                (eds, from, i) => {
                    const to = chain[i + 1]
                    if (eds.some((e) => e.from === from && e.to === to)) return eds
                    return [...eds, { from, to }]
                },
                acc.edges
            )
            return acc
        },
        { nodes: {}, edges: [] }
    )

    const graph = new Graph<string, { key: string }, {}>(nodes, edges, {}, true)
    const sccs = graph.topologicalSort()

    // Flatten SCCs in order; within each SCC (cycle) sort by asset ID for deterministic order.
    return sccs.flatMap((scc) => [...scc].sort((a, b) => a.localeCompare(b))) as AssetUUID[]
}
