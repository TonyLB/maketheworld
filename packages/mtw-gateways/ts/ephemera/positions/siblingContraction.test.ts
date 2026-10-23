import { contractionsOf, mergeablePairOf, mergeablePairUnder } from './siblingContraction'
import type { ConnectedToPair, ContractionBinding } from './siblingContraction'

// The cases are the topology corpus's (lambda/ephemera/dataSource/positions/AGENT.topology.corpus.md).
const under = (key: string, ...hosts: string[]): ContractionBinding => ({
    universalKey: key,
    fromHostPresences: hosts.map((host) => ({ host, presence: 'PRESENCE#Base' })),
})
const room = { host: 'ROOM#B', presence: 'PRESENCE#Base' }
const byOrder = () => 0

describe('mergeablePairOf', () => {
    it('merges two bare siblings (CT-C8(a))', () => {
        expect(mergeablePairOf([under('S1', 'ROOM#A'), under('S2', 'ROOM#A')], [])).toEqual({
            parent: { host: 'ROOM#A', presence: 'PRESENCE#Base' }, bindings: ['S1', 'S2'], reason: 'bare',
        })
    })

    it('merges a bare sibling into one with edges (CT-C8(b))', () => {
        expect(mergeablePairOf([under('S1', 'ROOM#A'), under('S2', 'ROOM#B'), under('S3', 'ROOM#A')], [['S1', 'S2']])?.bindings).toEqual(['S1', 'S3'])
    })

    it('keeps apart two siblings that both have edges and no edge between them (CT-C1)', () => {
        const thread = [under('T1', 'ROOM#A'), under('T2', 'ROOM#B'), under('T3', 'ROOM#C'), under('T4', 'ROOM#B'), under('T5', 'ROOM#D')]
        const edges: ConnectedToPair[] = [['T1', 'T2'], ['T2', 'T3'], ['T3', 'T4'], ['T4', 'T5']]
        expect(mergeablePairOf(thread, edges)).toBeUndefined()
    })

    it('keeps the minimal variant apart: two ends in one room, joined through the next (CT-C1)', () => {
        expect(mergeablePairOf([under('R1', 'ROOM#A'), under('R2', 'ROOM#B'), under('R3', 'ROOM#A')], [['R1', 'R2'], ['R2', 'R3']])).toBeUndefined()
    })

    it('contracts adjacent siblings on a string (CT-C2)', () => {
        expect(mergeablePairOf([under('R1', 'ROOM#A'), under('R2', 'ROOM#A')], [['R1', 'R2']])?.reason).toBe('adjacent')
    })

    it('keeps two adjacent branch points apart: the H stays an H (CT-C4)', () => {
        const net = [under('L', 'ROOM#B'), under('R', 'ROOM#B'), under('a', 'ROOM#A'), under('b', 'ROOM#C'), under('c', 'ROOM#D'), under('d', 'ROOM#E')]
        expect(mergeablePairOf(net, [['L', 'R'], ['L', 'a'], ['L', 'b'], ['R', 'c'], ['R', 'd']])).toBeUndefined()
    })

    it('keeps apart neighbors that share another neighbor, so a loop does not collapse (CT-C5)', () => {
        expect(mergeablePairOf([under('N1', 'ROOM#A'), under('N2', 'ROOM#A'), under('N3', 'ROOM#B')], [['N1', 'N2'], ['N2', 'N3'], ['N3', 'N1']])).toBeUndefined()
    })

    it('reads a ConnectedTo in either stored order as the same adjacency', () => {
        expect(mergeablePairOf([under('R1', 'ROOM#A'), under('R2', 'ROOM#A')], [['R2', 'R1']])?.reason).toBe('adjacent')
    })

    it('judges one parent at a time, counting every edge for degree', () => {
        const bindings = [under('S1', 'ROOM#A'), under('S2', 'ROOM#B'), under('S3', 'ROOM#B')]
        expect(mergeablePairUnder({ host: 'ROOM#A', presence: 'PRESENCE#Base' }, bindings, [])).toBeUndefined()
        expect(mergeablePairUnder(room, bindings, [['S2', 'S1'], ['S3', 'S1']])).toBeUndefined()
    })
})

describe('contractionsOf', () => {
    it('contracts a stretch pulled off a pulley with both neighbors in turn, keeping the far loop (CT-C3)', () => {
        // R1⟨room⟩ – Rp⟨room⟩ – R2⟨room⟩ – Rq⟨Q⟩ – R3⟨room⟩, after Rp is pulled off P.
        const bindings = [under('R1', 'ROOM#B'), under('Rp', 'ROOM#B'), under('R2', 'ROOM#B'), under('Rq', 'OBJECT#Q'), under('R3', 'ROOM#B')]
        const edges: ConnectedToPair[] = [['R1', 'Rp'], ['Rp', 'R2'], ['R2', 'Rq'], ['Rq', 'R3']]
        const result = contractionsOf(bindings, edges, (key) => (key === 'Rp' ? 1 : 0))
        expect(result.contractions).toEqual([
            { survivor: 'R1', absorbed: 'Rp', reason: 'adjacent', dissolve: [['R1', 'Rp'], ['Rp', 'R2']], establish: [['R1', 'R2']] },
            { survivor: 'R1', absorbed: 'R2', reason: 'adjacent', dissolve: [['R2', 'Rq'], ['R1', 'R2']], establish: [['R1', 'Rq']] },
        ])
        expect(result.bindings.map(({ universalKey }) => universalKey)).toEqual(['R1', 'Rq', 'R3'])
        expect(result.connectedTo).toEqual([['Rq', 'R3'], ['R1', 'Rq']])
    })

    it('collapses a string wholly under one parent to one binding (CT-C2(a))', () => {
        const result = contractionsOf([under('Base', 'ROOM#A'), under('R2', 'ROOM#A')], [['Base', 'R2']], byOrder)
        expect(result.contractions.map(({ survivor, absorbed }) => [survivor, absorbed])).toEqual([['Base', 'R2']])
        expect(result.connectedTo).toEqual([])
    })

    it('rewrites a bare survivor onto the absorbed binding\'s edges when rank picks the bare one', () => {
        const result = contractionsOf([under('S3', 'ROOM#A'), under('S1', 'ROOM#A'), under('S2', 'ROOM#B')], [['S1', 'S2']], (key) => (key === 'S3' ? 0 : 1))
        expect(result.contractions).toEqual([{ survivor: 'S3', absorbed: 'S1', reason: 'bare', dissolve: [['S1', 'S2']], establish: [['S3', 'S2']] }])
    })

    it('gives the survivor the union of both parent sets', () => {
        const result = contractionsOf([
            { universalKey: 'A', fromHostPresences: [room] },
            { universalKey: 'B', fromHostPresences: [room, { host: 'OBJECT#T', presence: 'PRESENCE#Base' }] },
        ], [], byOrder)
        expect(result.bindings).toEqual([{ universalKey: 'A', fromHostPresences: [room, { host: 'OBJECT#T', presence: 'PRESENCE#Base' }] }])
    })

    it('makes no contraction when nothing is mergeable', () => {
        expect(contractionsOf([under('T2', 'ROOM#B'), under('T4', 'ROOM#B')], [['T2', 'T3'], ['T4', 'T3']], byOrder).contractions).toEqual([])
    })
})
