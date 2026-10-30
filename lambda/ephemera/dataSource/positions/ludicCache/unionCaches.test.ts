/**
 * The union (`unionCaches.ts`, foldAsUnion Slice 2): nodes by key, crossing legs joined, unmatched legs kept.
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { unionAllLudicCaches, unionLudicCaches } from './unionCaches'
import type { EphemeraLudicCacheData, EphemeraLudicCacheEdge, EphemeraLudicCacheNode } from './types'

const a = 'OBJECT#A' as EphemeraObjectId
const b = 'OBJECT#B' as EphemeraObjectId
const c = 'OBJECT#C' as EphemeraObjectId
const hostA = a as EphemeraMembershipHostId
const hostB = b as EphemeraMembershipHostId
const port = { owner: b, port: 'PORT-one' } as const

const tied = { kind: 'Custom', relationLabel: 'tied to' } as const
const edge = (from: EphemeraLudicCacheEdge['from'], to: EphemeraLudicCacheEdge['to'], extra: Partial<EphemeraLudicCacheEdge> = {}): EphemeraLudicCacheEdge =>
    ({ tag: 'Relational', from, to, ...tied, ...extra }) as EphemeraLudicCacheEdge
const node = (universalKey: EphemeraObjectId, shortName?: string) => ({ tag: 'Object', universalKey, shortName, presenceNodes: [] }) as unknown as EphemeraLudicCacheNode
const cache = (hostId: EphemeraMembershipHostId, edges: EphemeraLudicCacheEdge[], nodes: EphemeraLudicCacheNode[] = []): EphemeraLudicCacheData => ({ hostId, nodes, edges })
const sorted = (edges: EphemeraLudicCacheEdge[]) => [...edges].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))

describe('unionLudicCaches', () => {
    const parentHalf = cache(hostA, [edge(a, port)])
    const childHalf = cache(hostB, [edge(port, c)])

    it('joins the two legs of a crossing port into the one edge, in either order', () => {
        expect(unionLudicCaches(parentHalf, childHalf).edges).toEqual([edge(a, c)])
        expect(unionLudicCaches(childHalf, parentHalf).edges).toEqual([edge(a, c)])
    })

    it('is idempotent: a half unioned with itself changes nothing', () => {
        expect(unionLudicCaches(parentHalf, parentHalf).edges).toEqual([edge(a, port)])
    })

    it('keeps an unmatched leg open', () => {
        expect(unionLudicCaches(parentHalf, cache(hostB, [])).edges).toEqual([edge(a, port)])
    })

    it('leaves a port named by three distinct legs open, however the reduction is shaped', () => {
        const third = cache(hostB, [edge(port, a, { relationLabel: 'tied to' })])
        const all = unionAllLudicCaches(hostA, [parentHalf, childHalf, third]).edges
        expect(sorted(all)).toEqual(sorted([edge(a, port), edge(port, c), edge(port, a)]))
    })

    it('throws when the two legs disagree', () => {
        expect(() => unionLudicCaches(parentHalf, cache(hostB, [edge(port, c, { kind: 'ConnectedTo' } as Partial<EphemeraLudicCacheEdge>)]))).toThrow(/disagree/)
    })

    it('never joins binding addresses', () => {
        const binding = { owner: b, port: 'PRESENCE#one' } as const
        const bindingEdges = unionLudicCaches(cache(hostA, [edge(a, binding)]), cache(hostB, [edge(c, binding)])).edges
        expect(sorted(bindingEdges)).toEqual(sorted([edge(a, binding), edge(c, binding)]))
    })

    it('takes nodes by key, the later cache winning a collision at the first position', () => {
        const union = unionLudicCaches(cache(hostA, [], [node(a, 'old'), node(b)]), cache(hostB, [], [node(a, 'new'), node(c)]))
        expect(union.nodes.map((n) => [n.universalKey, (n as { shortName?: string }).shortName])).toEqual([[a, 'new'], [b, undefined], [c, undefined]])
        expect(union.hostId).toBe(hostB)
    })

    it('is commutative as a set for a join', () => {
        const left = unionAllLudicCaches(hostA, [parentHalf, childHalf, cache(hostA, [edge(a, c, { kind: 'Custom', relationLabel: 'near' })])]).edges
        const right = unionAllLudicCaches(hostA, [cache(hostA, [edge(a, c, { kind: 'Custom', relationLabel: 'near' })]), childHalf, parentHalf]).edges
        expect(sorted(left)).toEqual(sorted(right))
    })
})

describe('an open leg whose pair another half already joined (FA-3)', () => {
    // The room row joined `a -> c` across the port `b` owns; the actor's fold walks only `b`, so it sees one open leg.
    const room = cache(hostA, [edge(a, c, { edgeId: 'edge_1' })])
    const strayLeg = edge(port, c, { edgeId: 'edge_1' })

    it('is dropped when the union holds the joined edge of the same relationship', () => {
        expect(unionLudicCaches(room, cache(hostB, [strayLeg])).edges).toEqual([edge(a, c, { edgeId: 'edge_1' })])
    })

    it('stays when the relationship cannot be proven the same (no edgeId, or a different one)', () => {
        const withoutId = cache(hostA, [edge(a, c)])
        expect(unionLudicCaches(withoutId, cache(hostB, [edge(port, c)])).edges).toHaveLength(2)
        expect(unionLudicCaches(room, cache(hostB, [edge(port, c, { edgeId: 'edge_2' })])).edges).toHaveLength(2)
    })
})
