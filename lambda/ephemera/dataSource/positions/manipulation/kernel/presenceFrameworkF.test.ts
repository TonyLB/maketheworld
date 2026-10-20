import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { BASE_PRESENCE_ID, UNPLACED_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraphNode, EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from './applyStepSequenceCore'
import { collisionsUnder, joinBindings, joinCollisions } from './joinPresenceBindings'
import type { MutationKernelStep } from './kernelStep'
import { reparentPresenceBinding } from './reparentPresenceBinding'
import { splitPresenceBinding } from './splitPresenceBinding'

// The corpus's hosts: a mover M whose bindings are C, C′ (the corpus's letters), parents A and B,
// a child host X, and a grandchild host Y.
const M = 'OBJECT#M' as EphemeraObjectId
const A = 'OBJECT#A' as EphemeraObjectId
const B = 'OBJECT#B' as EphemeraObjectId
const Q = 'OBJECT#Q' as EphemeraObjectId
const X = 'OBJECT#X' as EphemeraObjectId
const Y = 'OBJECT#Y' as EphemeraObjectId
const room = 'ROOM#Cafe' as EphemeraRoomId
const alpha = 'CHARACTER#Alpha' as EphemeraCharacterId

const id = (name: string) => (name.startsWith('PRESENCE#') ? name : `PRESENCE#${name}`) as any
const at = (host: EphemeraMembershipHostId, name: string = BASE_PRESENCE_ID) => ({ host, presence: id(name) })
const entry = (host: EphemeraMembershipHostId, name: string) => ({ host, presence: id(name) }) as any
const cover = (...members: ReturnType<typeof entry>[]): EphemeraPresenceCover => ({ members })
const bindings = (host: EphemeraMembershipHostId, ...nodes: EphemeraLudicGraphNode[]) => testLudicGraph(host, { nodes })
const world = (...graphs: EphemeraLudicGraph[]) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>(graphs.map((graph) => [graph.hostId, graph]))
const binding = (graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>, host: EphemeraMembershipHostId, name: string) => (
    graphs.get(host)!.presenceNodes.find(({ universalKey }) => universalKey === id(name))
)
const parentsNamed = (graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>, host: EphemeraMembershipHostId, name: string) => (
    (binding(graphs, host, name)?.fromHostPresences ?? []).map(({ host, presence }) => `${host}|${presence}`).sort()
)
const key = (host: EphemeraMembershipHostId, name: string) => `${host}|${id(name)}`
const coverOf = (graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>, host: EphemeraMembershipHostId, name: string) => (
    binding(graphs, host, name)?.cover.members.map(({ host, presence }) => `${host}|${presence}`).sort()
)
const ok = <T extends object>(result: T | { reasonCode: string }): T => {
    if ('reasonCode' in result) {
        throw new Error(`expected a write, got ${result.reasonCode}`)
    }
    return result
}

/** A, B and Q each hold a Base that lists the mover's bindings under it, and the mover's node where it lists any. */
const parentsOver = (listing: { A?: string[]; B?: string[]; Q?: string[] }) => (
    [[A, listing.A ?? []], [B, listing.B ?? []], [Q, listing.Q ?? []]] as const
).map(([host, names]) => bindings(
    host,
    ...(names.length ? [{ tag: 'Object' as const, universalKey: M }] : []),
    presenceBindingNode(BASE_PRESENCE_ID, undefined, cover(...names.map((name) => entry(M, name))))
))

describe('reparentPresenceBinding', () => {
    const start = () => world(
        ...parentsOver({ A: ['c'], B: ['c'] }),
        bindings(M, presenceBindingNode('c', [at(A), at(B)], cover(entry(X, 'x')))),
        bindings(X, presenceBindingNode('x', at(M, 'c')))
    )
    const reparent = (step: Partial<Extract<MutationKernelStep, { kind: 'reparentPresenceBinding' }>>) => (
        reparentPresenceBinding(start(), { kind: 'reparentPresenceBinding', hostId: M, presence: id('c'), ...step })
    )

    it('loses one parent and gains another, and moves the entry between the parents\' covers (M1)', () => {
        const { graphs, before, after } = ok(reparent({ lose: [at(A)], gain: [at(Q)] }))

        expect(parentsNamed(graphs, M, 'c')).toEqual([key(B, BASE_PRESENCE_ID), key(Q, BASE_PRESENCE_ID)].sort())
        expect(before).toHaveLength(2)
        expect(after).toHaveLength(2)
        expect(coverOf(graphs, A, BASE_PRESENCE_ID)).toEqual([])
        expect(coverOf(graphs, B, BASE_PRESENCE_ID)).toEqual([key(M, 'c')])
        expect(coverOf(graphs, Q, BASE_PRESENCE_ID)).toEqual([key(M, 'c')])
    })

    it('leaves the binding\'s cover and its children untouched', () => {
        const { graphs } = ok(reparent({ lose: [at(A), at(B)] }))

        expect(coverOf(graphs, M, 'c')).toEqual([key(X, 'x')])
        expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, 'c')])
    })

    it('treats a gain it already holds as a no-op', () => {
        const { graphs } = ok(reparent({ gain: [at(A)] }))

        expect(parentsNamed(graphs, M, 'c')).toHaveLength(2)
    })

    it('is stale when a lost parent is no longer in the set, or a name is missing', () => {
        expect(reparent({ lose: [at(Q)] })).toEqual({ reasonCode: 'presenceBindingMoved' })
        expect(reparent({ gain: [at(Q, 'gone')] })).toEqual({ reasonCode: 'destinationBindingMissing' })
        expect(reparent({ presence: id('nope') })).toEqual({ reasonCode: 'presenceBindingMissing' })
        expect(reparent({ gain: [at(room)] })).toEqual({ reasonCode: 'hostNotInFootprint' })
        expect(reparent({ hostId: room })).toEqual({ reasonCode: 'hostNotInFootprint' })
    })

    it('does not need a bystander\'s room in the footprint', () => {
        const graphs = world(bindings(alpha, presenceBindingNode('c', undefined)))
        const result = ok(reparentPresenceBinding(graphs, { kind: 'reparentPresenceBinding', hostId: alpha, presence: id('c'), gain: [at(room)] }))

        expect(parentsNamed(result.graphs, alpha, 'c')).toEqual([key(room, BASE_PRESENCE_ID)])
    })
})

describe('joinBindings', () => {
    // M15: C{A} = [x], C′{B} = [x]. Here the child is one binding under both.
    const sharedChild = () => world(
        ...parentsOver({ A: ['c'], B: ['c2'] }),
        bindings(M, presenceBindingNode('c', at(A), cover(entry(X, 'x'))), presenceBindingNode('c2', at(B), cover(entry(X, 'x')))),
        bindings(X, presenceBindingNode('x', [at(M, 'c'), at(M, 'c2')]))
    )

    it('merges two bindings into the one named, with the union of parents and covers (M15, M8)', () => {
        const { graphs, collisions } = ok(joinBindings(sharedChild(), { hostId: M, into: id('c'), toJoin: [id('c2')] }))

        expect(binding(graphs, M, 'c2')).toBeUndefined()
        expect(parentsNamed(graphs, M, 'c')).toEqual([key(A, BASE_PRESENCE_ID), key(B, BASE_PRESENCE_ID)].sort())
        expect(coverOf(graphs, M, 'c')).toEqual([key(X, 'x')])
        // the parents' covers follow
        expect(coverOf(graphs, A, BASE_PRESENCE_ID)).toEqual([key(M, 'c')])
        expect(coverOf(graphs, B, BASE_PRESENCE_ID)).toEqual([key(M, 'c')])
        // a child listed by both collapses to one pointer, and is not a collision
        expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, 'c')])
        expect(collisions).toEqual([])
    })

    it('swaps the joined binding for `into` in each child, and reports children that now collide', () => {
        const apart = world(
            ...parentsOver({ A: ['c'], B: ['c2'] }),
            bindings(M, presenceBindingNode('c', at(A), cover(entry(X, 'x1'))), presenceBindingNode('c2', at(B), cover(entry(X, 'x2')))),
            bindings(X, presenceBindingNode('x1', at(M, 'c')), presenceBindingNode('x2', at(M, 'c2')))
        )
        const { graphs, collisions } = ok(joinBindings(apart, { hostId: M, into: id('c'), toJoin: [id('c2')] }))

        expect(parentsNamed(graphs, X, 'x2')).toEqual([key(M, 'c')])
        expect(collisions).toEqual([{ host: X, presences: [id('x1'), id('x2')] }])
    })

    it('joins the collisions and the ones they leave one level down (M18)', () => {
        const apart = world(
            ...parentsOver({ A: ['c'], B: ['c2'] }),
            bindings(M, presenceBindingNode('c', at(A), cover(entry(X, 'x1'))), presenceBindingNode('c2', at(B), cover(entry(X, 'x2')))),
            bindings(X, presenceBindingNode('x1', at(M, 'c'), cover(entry(Y, 'y1'))), presenceBindingNode('x2', at(M, 'c2'), cover(entry(Y, 'y2')))),
            bindings(Y, presenceBindingNode('y1', at(X, 'x1')), presenceBindingNode('y2', at(X, 'x2')))
        )
        const first = ok(joinBindings(apart, { hostId: M, into: id('c'), toJoin: [id('c2')] }))
        const { graphs } = ok(joinCollisions(first.graphs, first.collisions))

        expect(graphs.get(X)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([id('x1')])
        expect(coverOf(graphs, X, 'x1')).toEqual([key(Y, 'y1')])
        expect(graphs.get(Y)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([id('y1')])
        expect(parentsNamed(graphs, Y, 'y1')).toEqual([key(X, 'x1')])
    })

    it('never dispenses with Base, and names a binding at most once', () => {
        const graphs = world(
            ...parentsOver({}),
            bindings(M, presenceBindingNode(BASE_PRESENCE_ID, undefined), presenceBindingNode('c', at(A)))
        )

        expect(joinBindings(graphs, { hostId: M, into: id('c'), toJoin: [BASE_PRESENCE_ID] })).toEqual({ reasonCode: 'joinDispensesBase' })
        expect(joinBindings(graphs, { hostId: M, into: BASE_PRESENCE_ID, toJoin: [id('c')] })).toHaveProperty('graphs')
        expect(joinBindings(graphs, { hostId: M, into: id('c'), toJoin: [id('c')] })).toEqual({ reasonCode: 'joinIntoInToJoin' })
        expect(joinBindings(graphs, { hostId: M, into: id('c'), toJoin: [id('gone')] })).toEqual({ reasonCode: 'presenceBindingMissing' })
    })

    it('is stale when a child no longer names the joined binding', () => {
        const graphs = world(
            ...parentsOver({ A: ['c'], B: ['c2'] }),
            bindings(M, presenceBindingNode('c', at(A)), presenceBindingNode('c2', at(B), cover(entry(X, 'x')))),
            bindings(X, presenceBindingNode('x', at(M, 'c')))
        )

        expect(joinBindings(graphs, { hostId: M, into: id('c'), toJoin: [id('c2')] })).toEqual({ reasonCode: 'presenceBindingMoved' })
    })
})

describe('splitPresenceBinding', () => {
    const start = () => world(
        ...parentsOver({ A: ['c'], B: ['c'] }),
        bindings(M, presenceBindingNode('c', [at(A), at(B)], cover(entry(X, 'x'), entry(Y, 'y')))),
        bindings(X, presenceBindingNode('x', at(M, 'c'))),
        bindings(Y, presenceBindingNode('y', at(M, 'c')))
    )
    const split = (pieces: Extract<MutationKernelStep, { kind: 'splitPresenceBinding' }>['pieces'], graphs = start()) => (
        splitPresenceBinding(graphs, { kind: 'splitPresenceBinding', hostId: M, presence: id('c'), pieces })
    )

    it('separates a shared binding into two (M16)', () => {
        const { graphs } = ok(split([
            { presence: id('c'), parents: [at(A)], cover: cover(entry(X, 'x'), entry(Y, 'y')) },
            { presenceUuid: 'c2', parents: [at(B)], cover: cover(entry(X, 'x'), entry(Y, 'y')) },
        ]))

        expect(parentsNamed(graphs, M, 'c')).toEqual([key(A, BASE_PRESENCE_ID)])
        expect(parentsNamed(graphs, M, 'c2')).toEqual([key(B, BASE_PRESENCE_ID)])
        expect(coverOf(graphs, A, BASE_PRESENCE_ID)).toEqual([key(M, 'c')])
        expect(coverOf(graphs, B, BASE_PRESENCE_ID)).toEqual([key(M, 'c2')])
        expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, 'c'), key(M, 'c2')].sort())
    })

    it('divides the cover as well, each child sitting under the pieces that cover it (M6)', () => {
        const { graphs } = ok(split([
            { presence: id('c'), parents: [at(A), at(B)], cover: cover(entry(X, 'x'), entry(Y, 'y')) },
            { presenceUuid: 'n', parents: [at(A)], cover: cover(entry(X, 'x')) },
        ]))

        // overlap is allowed: both pieces sit under A until a later step moves one
        expect(parentsNamed(graphs, M, 'n')).toEqual([key(A, BASE_PRESENCE_ID)])
        expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, 'c'), key(M, 'n')].sort())
        expect(parentsNamed(graphs, Y, 'y')).toEqual([key(M, 'c')])
        expect(coverOf(graphs, A, BASE_PRESENCE_ID)).toEqual([key(M, 'c'), key(M, 'n')].sort())
    })

    it('refuses pieces that do not make a split', () => {
        const whole = { parents: [at(A), at(B)], cover: cover(entry(X, 'x'), entry(Y, 'y')) }

        expect(split([{ presenceUuid: 'a', ...whole }, { presenceUuid: 'b', ...whole }])).toEqual({ reasonCode: 'splitKeepNotOne' })
        expect(split([{ presence: id('c'), ...whole }, { presence: id('c'), ...whole }])).toEqual({ reasonCode: 'splitKeepNotOne' })
        expect(split([{ presence: id('c'), ...whole }, { presenceUuid: 'c', ...whole }])).toEqual({ reasonCode: 'splitIdCollision' })
        expect(split([{ presence: id('c'), ...whole, parents: [at(A)] }])).toEqual({ reasonCode: 'splitPartsNotCovered' })
        expect(split([{ presence: id('c'), ...whole, cover: cover(entry(X, 'x')) }])).toEqual({ reasonCode: 'splitPartsNotCovered' })
        expect(split([{ presence: id('c'), ...whole, parents: [at(A), at(Q)] }])).toEqual({ reasonCode: 'splitPieceNotSubset' })
        expect(split([{ presence: id('c'), ...whole, cover: cover(entry(X, 'x'), entry(Y, 'y'), entry(Q, 'q')) }])).toEqual({ reasonCode: 'splitPieceNotSubset' })
    })

    it('is stale when a child no longer names the binding', () => {
        const graphs = start()
        graphs.set(X, bindings(X, presenceBindingNode('x', at(M, 'other'))))

        expect(split([{ presence: id('c'), parents: [at(A), at(B)], cover: cover(entry(X, 'x'), entry(Y, 'y')) }], graphs)).toEqual({ reasonCode: 'presenceBindingMoved' })
    })
})

describe('the primitives through applyStepSequenceCore', () => {
    const run = (steps: MutationKernelStep[], graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>): ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph> => {
        const outcome = applyStepSequenceCore(steps, graphs)
        if (outcome.verdict !== 'legal') {
            throw new Error(`expected legal, got ${JSON.stringify(outcome)}`)
        }
        return outcome.graphs
    }
    const reparent = (presence: string, lose: ReturnType<typeof at>[], gain: ReturnType<typeof at>[], hostId: EphemeraMembershipHostId = M): MutationKernelStep => (
        { kind: 'reparentPresenceBinding', hostId, presence: id(presence), lose, gain }
    )

    describe('removal and the root bindings (F-R1, F-R2)', () => {
        // M10: the mover's B{A} = [x] leaves A while Base sits under Q and covers something else.
        const placed = (baseCover: ReturnType<typeof entry>[]) => world(
            ...parentsOver({ A: ['b'], Q: [BASE_PRESENCE_ID] }),
            bindings(M, presenceBindingNode(BASE_PRESENCE_ID, at(Q), cover(...baseCover)), presenceBindingNode('b', at(A), cover(entry(X, 'x')))),
            bindings(X, presenceBindingNode('x', [at(M, 'b'), ...baseCover.map(() => at(M, BASE_PRESENCE_ID))]))
        )

        it('a binding that loses its last parent is removed, and its child falls to Unplaced (M10)', () => {
            const graphs = run([reparent('b', [at(A)], [])], placed([entry(Y, 'y')]).set(X, bindings(X, presenceBindingNode('x', at(M, 'b')))))

            expect(binding(graphs, M, 'b')).toBeUndefined()
            expect(coverOf(graphs, M, UNPLACED_PRESENCE_ID)).toEqual([key(X, 'x')])
            expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, UNPLACED_PRESENCE_ID)])
            expect(coverOf(graphs, A, BASE_PRESENCE_ID)).toEqual([])
        })

        it('a child that Base still covers does not fall (M11)', () => {
            const graphs = run([reparent('b', [at(A)], [])], placed([entry(X, 'x')]))

            expect(binding(graphs, M, 'b')).toBeUndefined()
            expect(binding(graphs, M, UNPLACED_PRESENCE_ID)).toBeUndefined()
            expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, BASE_PRESENCE_ID)])
        })

        it('Base going hostless keeps Unplaced, which does not collapse into it (M12)', () => {
            const before = world(
                ...parentsOver({ Q: [BASE_PRESENCE_ID] }),
                bindings(M, presenceBindingNode(BASE_PRESENCE_ID, at(Q), cover(entry(X, 'x'))), presenceBindingNode(UNPLACED_PRESENCE_ID, undefined, cover(entry(Y, 'y')))),
                bindings(X, presenceBindingNode('x', at(M, BASE_PRESENCE_ID))),
                bindings(Y, presenceBindingNode('y', at(M, UNPLACED_PRESENCE_ID)))
            )
            const graphs = run([reparent(BASE_PRESENCE_ID, [at(Q)], [])], before)

            expect(parentsNamed(graphs, M, BASE_PRESENCE_ID)).toEqual([])
            expect(coverOf(graphs, M, UNPLACED_PRESENCE_ID)).toEqual([key(Y, 'y')])
        })

        it('a binding given a parent by a later step is not removed', () => {
            const graphs = run([reparent('b', [at(A)], []), reparent('b', [], [at(B)])], placed([entry(Y, 'y')]).set(X, bindings(X, presenceBindingNode('x', at(M, 'b')))))

            expect(parentsNamed(graphs, M, 'b')).toEqual([key(B, BASE_PRESENCE_ID)])
            expect(binding(graphs, M, UNPLACED_PRESENCE_ID)).toBeUndefined()
        })

        it('children that fall into an Unplaced child already there are joined by the kernel', () => {
            const before = world(
                ...parentsOver({ A: ['b'] }),
                bindings(M, presenceBindingNode(BASE_PRESENCE_ID, undefined), presenceBindingNode('b', at(A), cover(entry(X, 'x2'))), presenceBindingNode(UNPLACED_PRESENCE_ID, undefined, cover(entry(X, 'x1')))),
                bindings(X, presenceBindingNode('x1', at(M, UNPLACED_PRESENCE_ID), cover(entry(Y, 'y1'))), presenceBindingNode('x2', at(M, 'b'), cover(entry(Y, 'y2')))),
                bindings(Y, presenceBindingNode('y1', at(X, 'x1')), presenceBindingNode('y2', at(X, 'x2')))
            )
            const graphs = run([reparent('b', [at(A)], [])], before)

            expect(graphs.get(X)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([id('x1')])
            expect(coverOf(graphs, X, 'x1')).toEqual([key(Y, 'y1')])
            expect(graphs.get(Y)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([id('y1')])
            expect(coverOf(graphs, M, UNPLACED_PRESENCE_ID)).toEqual([key(X, 'x1')])
        })
    })

    describe('a split followed by a reparent', () => {
        it('places part of a hostless Base elsewhere, leaving Base\'s own parents alone (M9)', () => {
            const before = world(
                ...parentsOver({}),
                bindings(M, presenceBindingNode(BASE_PRESENCE_ID, undefined, cover(entry(X, 'x'), entry(Y, 'y')))),
                bindings(X, presenceBindingNode('x', at(M, BASE_PRESENCE_ID))),
                bindings(Y, presenceBindingNode('y', at(M, BASE_PRESENCE_ID)))
            )
            const graphs = run([
                { kind: 'splitPresenceBinding', hostId: M, presence: BASE_PRESENCE_ID, pieces: [
                    { presence: BASE_PRESENCE_ID, parents: [], cover: cover(entry(Y, 'y')) },
                    { presenceUuid: 'n', parents: [], cover: cover(entry(X, 'x')) },
                ] },
                reparent('n', [], [at(Q)]),
            ], before)

            expect(parentsNamed(graphs, M, BASE_PRESENCE_ID)).toEqual([])
            expect(coverOf(graphs, M, BASE_PRESENCE_ID)).toEqual([key(Y, 'y')])
            expect(parentsNamed(graphs, M, 'n')).toEqual([key(Q, BASE_PRESENCE_ID)])
            expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, 'n')])
        })

        it('moves one parent\'s view of an entry, the other parent seeing everything (M6)', () => {
            const before = world(
                ...parentsOver({ A: ['b'], B: ['b'] }),
                bindings(M, presenceBindingNode('b', [at(A), at(B)], cover(entry(X, 'x'), entry(Y, 'y')))),
                bindings(X, presenceBindingNode('x', at(M, 'b'))),
                bindings(Y, presenceBindingNode('y', at(M, 'b')))
            )
            const graphs = run([
                { kind: 'splitPresenceBinding', hostId: M, presence: id('b'), pieces: [
                    { presence: id('b'), parents: [at(B)], cover: cover(entry(X, 'x'), entry(Y, 'y')) },
                    { presenceUuid: 'rest', parents: [at(A)], cover: cover(entry(Y, 'y')) },
                    { presenceUuid: 'n', parents: [at(A)], cover: cover(entry(X, 'x')) },
                ] },
                reparent('n', [at(A)], [at(Q)]),
            ], before)

            expect(parentsNamed(graphs, M, 'b')).toEqual([key(B, BASE_PRESENCE_ID)])
            expect(parentsNamed(graphs, M, 'rest')).toEqual([key(A, BASE_PRESENCE_ID)])
            expect(parentsNamed(graphs, M, 'n')).toEqual([key(Q, BASE_PRESENCE_ID)])
            expect(parentsNamed(graphs, X, 'x')).toEqual([key(M, 'b'), key(M, 'n')].sort())
        })

        it('removes a piece that was never given a parent, and its child falls to Unplaced', () => {
            const before = world(
                ...parentsOver({}),
                bindings(M, presenceBindingNode(BASE_PRESENCE_ID, undefined, cover(entry(X, 'x'), entry(Y, 'y')))),
                bindings(X, presenceBindingNode('x', at(M, BASE_PRESENCE_ID))),
                bindings(Y, presenceBindingNode('y', at(M, BASE_PRESENCE_ID)))
            )
            const graphs = run([{ kind: 'splitPresenceBinding', hostId: M, presence: BASE_PRESENCE_ID, pieces: [
                { presence: BASE_PRESENCE_ID, parents: [], cover: cover(entry(Y, 'y')) },
                { presenceUuid: 'n', parents: [], cover: cover(entry(X, 'x')) },
            ] }], before)

            expect(binding(graphs, M, 'n')).toBeUndefined()
            expect(coverOf(graphs, M, UNPLACED_PRESENCE_ID)).toEqual([key(X, 'x')])
        })
    })

    describe('the run\'s end refuses what a producer left unjoined (F-R3)', () => {
        const ringsWorld = () => world(
            ...parentsOver({ A: ['c'], B: ['c2'] }),
            bindings(M, presenceBindingNode('c', at(A), cover(entry(X, 'x'))), presenceBindingNode('c2', at(B), cover(entry(X, 'x')))),
            bindings(X, presenceBindingNode('x', [at(M, 'c'), at(M, 'c2')]))
        )

        it('Q1: two bindings under one parent throw', () => {
            const before = world(
                ...parentsOver({ A: ['c'], B: ['c'] }),
                bindings(M, presenceBindingNode('c', [at(A), at(B)], cover(entry(X, 'x')))),
                bindings(X, presenceBindingNode('x', at(M, 'c')))
            )

            expect(() => run([{ kind: 'splitPresenceBinding', hostId: M, presence: id('c'), pieces: [
                { presence: id('c'), parents: [at(A), at(B)], cover: cover(entry(X, 'x')) },
                { presenceUuid: 'd', parents: [at(A)], cover: cover(entry(X, 'x')) },
            ] }], before)).toThrow(/two bindings under the same parent binding/)
        })

        it('a reparent that gains a parent another binding already sits under throws until a join is written', () => {
            expect(() => run([reparent('c2', [at(B)], [at(A)])], ringsWorld())).toThrow(/two bindings under the same parent binding/)
            const graphs = run([
                reparent('c2', [at(B)], [at(A)]),
                { kind: 'joinPresenceBindings', hostId: M, into: id('c'), toJoin: [id('c2')], cascadeHosts: [X] },
            ], ringsWorld())

            expect(parentsNamed(graphs, M, 'c')).toEqual([key(A, BASE_PRESENCE_ID)])
            expect(coverOf(graphs, B, BASE_PRESENCE_ID)).toEqual([])
        })

        it('a join leaves children that collide for the producer to join', () => {
            const apart = world(
                ...parentsOver({ A: ['c'], B: ['c2'] }),
                bindings(M, presenceBindingNode('c', at(A), cover(entry(X, 'x1'))), presenceBindingNode('c2', at(B), cover(entry(X, 'x2')))),
                bindings(X, presenceBindingNode('x1', at(M, 'c')), presenceBindingNode('x2', at(M, 'c2')))
            )
            const steps: MutationKernelStep[] = [
                { kind: 'joinPresenceBindings', hostId: M, into: id('c'), toJoin: [id('c2')], cascadeHosts: [X] },
            ]

            expect(() => run(steps, apart)).toThrow(/two bindings under the same parent binding/)
            expect(run([...steps, { kind: 'joinPresenceBindings', hostId: X, into: id('x1'), toJoin: [id('x2')] }], apart).get(X)!.presenceNodes).toHaveLength(1)
        })
    })

    it('a stale step is a verdict, not a throw', () => {
        const outcome = applyStepSequenceCore([reparent('c', [at(Q)], [])], world(...parentsOver({}), bindings(M, presenceBindingNode('c', at(A)))))

        expect(outcome).toEqual({ verdict: 'stale', reasonCode: 'presenceBindingMoved' })
    })

    it('reparenting a mover to a new host settles its membership there', () => {
        const before = world(
            bindings(room, presenceBindingNode(BASE_PRESENCE_ID, undefined, cover(entry(M, 'c'))), { tag: 'Object', universalKey: M } as any),
            bindings(Q, presenceBindingNode(BASE_PRESENCE_ID, undefined)),
            bindings(M, presenceBindingNode('c', at(room)))
        )
        const graphs = run([reparent('c', [at(room)], [at(Q)])], before)

        expect(graphs.get(room)!.nodeIds.has(M)).toBe(false)
        expect(graphs.get(Q)!.nodeIds.has(M)).toBe(true)
    })

    describe('collisionsUnder', () => {
        it('prefers the bindings that were not just placed', () => {
            const graphs = world(
                bindings(X, presenceBindingNode('old', at(M, UNPLACED_PRESENCE_ID)), presenceBindingNode('new', at(M, UNPLACED_PRESENCE_ID)))
            )

            expect(collisionsUnder(graphs, at(M, UNPLACED_PRESENCE_ID), [entry(X, 'new')])).toEqual([{ host: X, presences: [id('old'), id('new')] }])
        })
    })
})
