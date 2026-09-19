/**
 * No shipped writer today constructs a matched pair of crossing-port legs (see
 * `AGENT.presence.planning.md`'s PR-12 Obligation A). Every fixture below is hand-authored --- invented for this test, not read off
 * storage.
 */
import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphComponentNode, EphemeraLudicGraphPort, EphemeraLudicGraphStructureNode, EphemeraLudicRelationalEdgeData, EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { nodesFromPresenceBinding, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { collapseCrossingPorts, collapseSameHostStubs, foldSameHostBuckets, mergeSameHostBucket } from './mergeReducer'
import { isEphemeraLudicCacheEdge } from './types'

const roomId = 'ROOM#Root' as EphemeraRoomId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const objB = 'OBJECT#B' as EphemeraObjectId
const boulder = 'OBJECT#Boulder' as EphemeraObjectId
const pebble = 'OBJECT#Pebble' as EphemeraObjectId
const feather = 'OBJECT#Feather' as EphemeraObjectId
const charA = 'CHARACTER#A' as EphemeraCharacterId
const charB = 'CHARACTER#B' as EphemeraCharacterId
const charC = 'CHARACTER#C' as EphemeraCharacterId
const objC = 'OBJECT#C' as EphemeraObjectId
const objD = 'OBJECT#D' as EphemeraObjectId
const objE = 'OBJECT#E' as EphemeraObjectId
const objF = 'OBJECT#F' as EphemeraObjectId
const objE2 = 'OBJECT#E2' as EphemeraObjectId

/** A dummy `presence` disambiguator per member --- these fixtures don't exercise a covered
 * component's own multiple bindings (PN-22), so any well-formed `PRESENCE#` id suffices. */
const enumeratedCover = (...hosts: EphemeraLudicGraphComponentNode['universalKey'][]): EphemeraPresenceCover => ({
    tag: 'Enumerated',
    members: hosts.map((host) => ({ host, presence: `PRESENCE#${host}-binding` as EphemeraPresenceNodeId })),
})

/** The presence node minted for the binding named `portId` (presenceNodes Slice 3; no port record as of Slice 7a). */
const presenceNode = (portId: string, cover: EphemeraPresenceCover): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: `PRESENCE#${portId}` as EphemeraPresenceNodeId,
    fromHostId: roomId,
    cover,
})

const crossingPort = (portId: string, kind: EphemeraLudicGraphPort['kind'] = 'On'): EphemeraLudicGraphPort => ({
    portId,
    fromHostId: roomId,
    kind,
})

const parentLeg = (portId: string, kind: EphemeraLudicRelationalEdgeData['kind'] = 'On'): EphemeraLudicRelationalEdgeData => ({
    tag: 'Relational',
    from: boulder,
    to: { owner: boxId, port: portId },
    kind,
} as EphemeraLudicRelationalEdgeData)

const childLeg = (portId: string, to: EphemeraLudicRelationalEdgeData['to'], kind: EphemeraLudicRelationalEdgeData['kind'] = 'On'): EphemeraLudicRelationalEdgeData => ({
    tag: 'Relational',
    from: { owner: boxId, port: portId },
    to,
    kind,
} as EphemeraLudicRelationalEdgeData)

describe('collapseCrossingPorts', () => {
    it('collapses a single matched leg pair into one edge with a one-hop, one-route supportedBy', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('port_1')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('port_1', pebble)],
            ports: [crossingPort('port_1')],
        })

        expect(collapseCrossingPorts(parentGraph, childGraph, 'binding_1')).toEqual([
            {
                tag: 'Relational',
                from: boulder,
                to: pebble,
                kind: 'On',
                supportedBy: [[{ presenceBucketIds: ['PRESENCE#binding_1'], port: 'port_1' }]],
            },
        ])
    })

    it('groups two independently-matched leg pairs landing on the same edge identity, without merging their routes', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('port_1'), parentLeg('port_2')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('port_1', pebble), childLeg('port_2', pebble)],
            ports: [crossingPort('port_1'), crossingPort('port_2')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph, 'binding_1')
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ from: boulder, to: pebble, kind: 'On' })
        expect(result[0].supportedBy).toEqual(expect.arrayContaining([
            [{ presenceBucketIds: ['PRESENCE#binding_1'], port: 'port_1' }],
            [{ presenceBucketIds: ['PRESENCE#binding_1'], port: 'port_2' }],
        ]))
        expect(result[0].supportedBy).toHaveLength(2)
    })

    // Slice 3f (ISS8149): `edgeId` used to be missing from the grouping key, so two collapsed
    // edges differing only in `edgeId` merged into one record --- second site of the same defect
    // `legsAgree`'s test above fixes. They must stay two distinct records, not one with a
    // concatenated `supportedBy`.
    it('does not group two collapsed edges that agree on (from, to, kind) but disagree on edgeId', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [
                { ...parentLeg('port_1'), edgeId: 'edge_1' },
                { ...parentLeg('port_2'), edgeId: 'edge_2' },
            ],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [
                { ...childLeg('port_1', pebble), edgeId: 'edge_1' },
                { ...childLeg('port_2', pebble), edgeId: 'edge_2' },
            ],
            ports: [crossingPort('port_1'), crossingPort('port_2')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph, 'binding_1')
        expect(result).toHaveLength(2)
        expect(result.map((edge) => edge.supportedBy)).toEqual(expect.arrayContaining([
            [[{ presenceBucketIds: ['PRESENCE#binding_1'], port: 'port_1' }]],
            [[{ presenceBucketIds: ['PRESENCE#binding_1'], port: 'port_2' }]],
        ]))
    })

    // The payoff for tagging the exterior address (PN-24), and the case Slice 5 could not close.
    // One presence binding has two addresses --- its bare node id, and the exterior
    // `{ owner, port: 'PRESENCE#...' }` form --- so two legs reaching the SAME binding by different
    // addresses must land on one cache record with two routes, not two records asserting one edge
    // twice. `collapsedEdgeIdentityKey` normalizes DOWN to the bare id, which is why the surviving
    // record's `to` is the primitive form.
    it('dedups two legs reaching one presence binding by its two different addresses', () => {
        const binding = 'PRESENCE#b1' as EphemeraPresenceNodeId
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('port_1'), parentLeg('port_2')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, presenceNode('b1', enumeratedCover(boxId))],
            edges: [
                childLeg('port_1', binding),
                childLeg('port_2', { owner: boxId, port: binding }),
            ],
            ports: [crossingPort('port_1'), crossingPort('port_2')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph, 'binding_1')
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ from: boulder, to: binding, kind: 'On' })
        expect(result[0].supportedBy).toHaveLength(2)
    })

    it('does not collapse two edges that only coincidentally reach the same identity if their kinds disagree', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('port_1', 'On')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('port_1', pebble, 'Under')],
            ports: [crossingPort('port_1')],
        })

        expect(() => collapseCrossingPorts(parentGraph, childGraph, 'binding_1')).toThrow(/disagree/)
    })

    it('skips a crossing port with no matching leg on the parent side', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }],
            edges: [],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: feather }],
            edges: [childLeg('port_1', feather)],
            ports: [crossingPort('port_1')],
        })

        expect(collapseCrossingPorts(parentGraph, childGraph, 'binding_1')).toEqual([])
    })

    // Slice 3f (ISS8149): `edgeId` used to be invisible to `legsAgree`, so two legs carrying
    // different `edgeId` labels collapsed silently, discarding the child leg's label. Nothing
    // mints an `edgeId` yet, so this is a hand-authored pair per the plan's own instruction not
    // to defer on that account.
    it('throws when two legs disagree on edgeId, matching every other identity field it already asserts', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [{ ...parentLeg('port_1'), edgeId: 'edge_parent' }],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [{ ...childLeg('port_1', pebble), edgeId: 'edge_child' }],
            ports: [crossingPort('port_1')],
        })

        expect(() => collapseCrossingPorts(parentGraph, childGraph, 'binding_1')).toThrow(/disagree/)
    })
})

describe('collapseSameHostStubs', () => {
    it('reconstructs an interior edge between two nodes exclusive to different same-host buckets, cut separately', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Character', universalKey: charB },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
                presenceNode('port_1', enumeratedCover(charA, objC)),
                presenceNode('port_2', enumeratedCover(charB, objD)),
            ],
            edges: [
                { tag: 'Relational', from: objC, to: objD, kind: 'Under' },
            ],
        })

        // The naive fold move: cut each bucket alone (rather than unioning first), producing
        // two independently stub-ported halves of the same interior edge --- the case
        // `nodesFromPresenceBindings`'s own doc comment names as needing "its own reconciliation
        // step". Confirmed target behavior (union-then-cut needs no such step) is already
        // covered by presenceSubGraph.test.ts's "feeding the union into subGraphFromNodes"
        // case; this is the separate-cuts path a fold would actually produce.
        const bucketA = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, 'port_1'))
        const bucketB = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, 'port_2'))

        expect(bucketA.ports).toHaveLength(1)
        expect(bucketB.ports).toHaveLength(1)

        expect(collapseSameHostStubs(bucketA, bucketB)).toEqual([
            { tag: 'Relational', from: objC, to: objD, kind: 'Under', supportedBy: [] },
        ])
    })

    it('does not collapse two stub ports that only coincidentally share an id if their legs disagree', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'STUB-1' }, kind: 'Under' }],
            ports: [{ portId: 'STUB-1', fromHostId: objD, kind: 'Under' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objD }],
            edges: [{ tag: 'Relational', from: { owner: roomId, port: 'STUB-1' }, to: objD, kind: 'Against' }],
            ports: [{ portId: 'STUB-1', fromHostId: objC, kind: 'Against' }],
        })

        expect(() => collapseSameHostStubs(bucketA, bucketB)).toThrow(/disagree/)
    })

    it('skips a stub port present in only one bucket', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'STUB-1' }, kind: 'Under' }],
            ports: [{ portId: 'STUB-1', fromHostId: objD, kind: 'Under' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objE2 }],
            edges: [],
            ports: [],
        })

        expect(collapseSameHostStubs(bucketA, bucketB)).toEqual([])
    })

    //
    // The failure this exists to prevent, and it would have been silent: a port-to-port transit
    // leg (LC10's shape) is kept by every bucket, and `subGraphFromNodes` now carries the authored
    // ports it names alongside it --- so the *same real* boundary is present on both sides with a
    // leg touching it on both sides. Matched as a stub, it splices to itself into
    // `cross_1 -[RopedTo]-> cross_1`, and `legsAgree` cannot object, because the two legs are the
    // same leg. Only the minted-vs-authored distinction rules it out.
    //
    it('does not splice an authored crossing port present in both buckets', () => {
        const transitLeg = {
            tag: 'Relational' as const,
            from: { owner: roomId, port: 'cross_1' },
            to: { owner: roomId, port: 'cross_2' },
            kind: 'Custom' as const,
            relationLabel: 'RopedTo',
        }
        const authored = [
            { portId: 'cross_1', fromHostId: objC, kind: 'Custom' as const, exteriorRelationLabel: 'RopedTo' },
            { portId: 'cross_2', fromHostId: objD, kind: 'Custom' as const, exteriorRelationLabel: 'RopedTo' },
        ]
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [transitLeg],
            ports: authored,
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objD }],
            edges: [transitLeg],
            ports: authored,
        })

        expect(collapseSameHostStubs(bucketA, bucketB)).toEqual([])
    })
})

describe('mergeSameHostBucket', () => {
    const transitLeg = {
        tag: 'Relational' as const,
        from: { owner: roomId, port: 'cross_1' },
        to: { owner: roomId, port: 'cross_2' },
        kind: 'Custom' as const,
        relationLabel: 'RopedTo',
    }
    const authored = [
        { portId: 'cross_1', fromHostId: objC, kind: 'Custom' as const, exteriorRelationLabel: 'RopedTo' },
        { portId: 'cross_2', fromHostId: objD, kind: 'Custom' as const, exteriorRelationLabel: 'RopedTo' },
    ]

    //
    // A transit leg has no bucket of its own, so every bucket keeps a copy and both copies reach
    // the merge. They are cuts of one source edge and agree in every field, so the merge keeps one
    // --- and keeps the boundary it names, which no same-host merge can resolve.
    //
    it('carries an authored boundary and its transit leg forward once, not twice', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [transitLeg],
            ports: authored,
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objD }],
            edges: [transitLeg],
            ports: authored,
        })

        const merged = mergeSameHostBucket(bucketA, bucketB)
        expect(merged.relationalEdges).toEqual([
            { from: transitLeg.from, to: transitLeg.to, kind: 'Custom', relationLabel: 'RopedTo' },
        ])
        expect(merged.ports).toEqual(authored)
        expect([...merged.nodeIds]).toEqual(expect.arrayContaining([roomId, objC, objD]))
    })

    it('still consumes a minted stub matched on both sides', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'STUB-1' }, kind: 'Under' }],
            ports: [{ portId: 'STUB-1', fromHostId: objD, kind: 'Under' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objD }],
            edges: [{ tag: 'Relational', from: { owner: roomId, port: 'STUB-1' }, to: objD, kind: 'Under' }],
            ports: [{ portId: 'STUB-1', fromHostId: objC, kind: 'Under' }],
        })

        const merged = mergeSameHostBucket(bucketA, bucketB)
        expect(merged.relationalEdges).toEqual([{ from: objC, to: objD, kind: 'Under' }])
        expect(merged.ports).toEqual([])
    })
})

describe('foldSameHostBuckets', () => {
    // Three presence buckets on one host. `objC -[Under]-> objD` straddles the adjacent pair
    // (bucket 1/bucket 2), same as `collapseSameHostStubs`'s own test above. `objE
    // -[Against]-> objF` straddles bucket 1 and bucket 3 with bucket 2 contributing nothing to
    // it at all --- the case that forces a real walk to carry bucket 1's unmatched stub *through*
    // bucket 2 (which cannot resolve it) rather than only comparing each bucket to its immediate
    // predecessor.
    const graph = testLudicGraph(roomId, {
        nodes: [
            { tag: 'Room', universalKey: roomId },
            { tag: 'Character', universalKey: charA },
            { tag: 'Character', universalKey: charB },
            { tag: 'Character', universalKey: charC },
            { tag: 'Object', universalKey: objC },
            { tag: 'Object', universalKey: objD },
            { tag: 'Object', universalKey: objE },
            { tag: 'Object', universalKey: objF },
            presenceNode('port_1', enumeratedCover(charA, objC, objE)),
            presenceNode('port_2', enumeratedCover(charB, objD)),
            presenceNode('port_3', enumeratedCover(charC, objF)),
        ],
        edges: [
            { tag: 'Relational', from: objC, to: objD, kind: 'Under' },
            { tag: 'Relational', from: objE, to: objF, kind: 'Against' },
        ],
    })

    const expectedEdges = [
        { tag: 'Relational', from: objC, to: objD, kind: 'Under', supportedBy: [] },
        { tag: 'Relational', from: objE, to: objF, kind: 'Against', supportedBy: [] },
    ]

    it('reconstructs both interior edges via the existing pairwise primitive, cutting every bucket up front (two-pass baseline, using only shipped code)', () => {
        const bucketA = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, 'port_1'))
        const bucketB = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, 'port_2'))
        const bucketC = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, 'port_3'))

        const result = [
            ...collapseSameHostStubs(bucketA, bucketB),
            ...collapseSameHostStubs(bucketB, bucketC),
            ...collapseSameHostStubs(bucketA, bucketC),
        ]

        expect(result).toHaveLength(2)
        expect(result).toEqual(expect.arrayContaining(expectedEdges))
    })

    it('reconstructs the same two edges via a single accumulating fold walk, cutting one bucket at a time', () => {
        const result = foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3'])

        expect(result.edges).toHaveLength(2)
        expect(result.edges).toEqual(expect.arrayContaining(expectedEdges))
    })

    it('does not depend on the order buckets are visited in --- a still-open stub is carried in the walk\'s own state, not compared only to the immediately preceding bucket', () => {
        const forward = foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3'])
        const shuffled = foldSameHostBuckets(graph, ['port_3', 'port_1', 'port_2'])

        expect(forward.edges).toHaveLength(2)
        expect(shuffled.edges).toHaveLength(2)
        expect(forward.edges).toEqual(expect.arrayContaining(expectedEdges))
        expect(shuffled.edges).toEqual(expect.arrayContaining(expectedEdges))
    })

    it('mints one consolidated structure-arm cache node per binding folded, with an Enumerated cover matching the graph-side binding (item 3, PN-7/PN-15/PN-19)', () => {
        const result = foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3'])

        expect(result.nodes).toHaveLength(3)
        expect(result.nodes).toEqual(expect.arrayContaining([
            {
                tag: 'Presence',
                universalKey: 'PRESENCE#port_1',
                fromHostId: roomId,
                consolidated: true,
                cover: {
                    tag: 'Enumerated',
                    members: expect.arrayContaining([
                        { host: charA, presence: 'PRESENCE#port_1' },
                        { host: objC, presence: 'PRESENCE#port_1' },
                        { host: objE, presence: 'PRESENCE#port_1' },
                    ]),
                },
            },
            {
                tag: 'Presence',
                universalKey: 'PRESENCE#port_2',
                fromHostId: roomId,
                consolidated: true,
                cover: {
                    tag: 'Enumerated',
                    members: expect.arrayContaining([
                        { host: charB, presence: 'PRESENCE#port_2' },
                        { host: objD, presence: 'PRESENCE#port_2' },
                    ]),
                },
            },
            {
                tag: 'Presence',
                universalKey: 'PRESENCE#port_3',
                fromHostId: roomId,
                consolidated: true,
                cover: {
                    tag: 'Enumerated',
                    members: expect.arrayContaining([
                        { host: charC, presence: 'PRESENCE#port_3' },
                        { host: objF, presence: 'PRESENCE#port_3' },
                    ]),
                },
            },
        ]))
    })

    it('mints nothing for a presenceUuid with no matching graph node (degenerate: no node minted, or a stale/legacy binding), given every real binding is otherwise consolidated', () => {
        const result = foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3', 'nonexistent'])

        expect(result.nodes).toHaveLength(3)
        expect(result.nodes.map((node) => node.universalKey).sort()).toEqual([
            'PRESENCE#port_1', 'PRESENCE#port_2', 'PRESENCE#port_3',
        ])
    })

    it("throws when presenceUuids consolidates a proper subset of the host's real presence bindings (clause 3: zero or all, never some)", () => {
        expect(() => foldSameHostBuckets(graph, ['port_1'])).toThrow(/zero or all/)
    })

    it('does not throw when presenceUuids is empty (unexamined) or names every real binding (fully consolidated)', () => {
        expect(() => foldSameHostBuckets(graph, [])).not.toThrow()
        expect(() => foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3'])).not.toThrow()
    })
})

//
// ISS8149 Slice 1 --- LC8's first job, run rather than re-derived, and the two sibling cases
// (LC10/LC11) gap 6 moved to once LC8 was found not to reach the bare port-to-port shape. See
// taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.ludicCache.corpus.planning.md
// for the setups these fixtures encode and the findings this probe feeds back into.
//
// LC8's diamond: OBJECT#B and OBJECT#C are both ROOM#A's direct children (`In`), OBJECT#D is
// `In` OBJECT#B *and* `PartOf` OBJECT#C -- a genuine diamond, but stated as two independently
// authored graphs (B's own, C's own), neither of which mints a port for D at all.
//
// LC10/LC11 add a peer edge, `OBJECT#D -Against-> OBJECT#E` (E is `PartOf` OBJECT#C only), and
// the corpus's own text notes the world edge has two *routes* that were never disambiguated:
// stated wholly inside OBJECT#C's own graph (both D and E are its members, interior, no port)
// or stated at ROOM#A's level as a boundary-crossing edge between B's and C's exterior ports
// (since only D, not E, is reachable from inside B). Only the second route ever reaches
// `collapseCrossingPorts` at all -- the first route has no crossing port for the reducer to
// act on, and surfacing it is Slice 2/3's job (node enumeration and the real fold), neither
// built yet. So the fixtures below encode the *routed-through-ports* reading, which is the one
// this slice can actually run against shipped code; the interior-to-C reading is recorded as a
// standing alternative rather than exercised, per LC8/LC10's own "a route was chosen" hazard.
//
describe('LC8/LC10/LC11: the box-and-contraption diamond', () => {
    const roomNodes = [
        { tag: 'Room' as const, universalKey: roomId },
        { tag: 'Object' as const, universalKey: objB },
        { tag: 'Object' as const, universalKey: objC },
    ]
    const roomHostingEdges = [
        { tag: 'Relational' as const, from: objB, to: roomId, kind: 'In' as const },
        { tag: 'Relational' as const, from: objC, to: roomId, kind: 'In' as const },
    ]

    // OBJECT#D's two hostings, each interior to its own host's graph and referencing no port.
    const bGraph = testLudicGraph(objB, {
        nodes: [{ tag: 'Object', universalKey: objB }, { tag: 'Object', universalKey: objD }],
        edges: [{ tag: 'Relational', from: objD, to: objB, kind: 'In' }],
    })
    const cGraphHostingOnly = testLudicGraph(objC, {
        nodes: [{ tag: 'Object', universalKey: objC }, { tag: 'Object', universalKey: objD }, { tag: 'Object', universalKey: objE }],
        edges: [
            { tag: 'Relational', from: objD, to: objC, kind: 'PartOf' },
            { tag: 'Relational', from: objE, to: objC, kind: 'PartOf' },
        ],
    })
    const roomGraph = testLudicGraph(roomId, { nodes: roomNodes, edges: roomHostingEdges })

    it("produces no join edge for D's hosting from either order, because neither host mints a port for it (LC8 first job, answered in the negative)", () => {
        const mergeB = collapseCrossingPorts(roomGraph, bGraph, 'binding_B')
        const mergeC = collapseCrossingPorts(roomGraph, cGraphHostingOnly, 'binding_C')

        expect(mergeB).toEqual([])
        expect(mergeC).toEqual([])
        // Order variant: running the merges in the other order, against the same unmodified
        // parent, changes nothing either -- there is no accumulated state for a join to depend
        // on, because there was never a crossing port to begin with.
        expect(collapseCrossingPorts(roomGraph, cGraphHostingOnly, 'binding_C')).toEqual(mergeC)
        expect(collapseCrossingPorts(roomGraph, bGraph, 'binding_B')).toEqual(mergeB)
    })

    // The peer edge, stated at ROOM#A's level as a boundary crossing between B's and C's exterior
    // ports -- the "routed through B" reading LC10 names, reached without inventing a mediator.
    const roomGraphWithAgainst = testLudicGraph(roomId, {
        nodes: roomNodes,
        edges: [
            ...roomHostingEdges,
            { tag: 'Relational', from: { owner: objB, port: 'p_b' }, to: { owner: objC, port: 'p_c' }, kind: 'Against' },
        ],
    })
    const bGraphWithPort = testLudicGraph(objB, {
        nodes: [{ tag: 'Object', universalKey: objB }, { tag: 'Object', universalKey: objD }],
        edges: [
            { tag: 'Relational', from: objD, to: objB, kind: 'In' },
            { tag: 'Relational', from: { owner: objB, port: 'p_b' }, to: objD, kind: 'Against' },
        ],
        ports: [{ portId: 'p_b', fromHostId: objB, kind: 'Against' }],
    })
    const cGraphWithPort = testLudicGraph(objC, {
        nodes: [{ tag: 'Object', universalKey: objC }, { tag: 'Object', universalKey: objD }, { tag: 'Object', universalKey: objE }],
        edges: [
            { tag: 'Relational', from: objD, to: objC, kind: 'PartOf' },
            { tag: 'Relational', from: objE, to: objC, kind: 'PartOf' },
            { tag: 'Relational', from: { owner: objC, port: 'p_c' }, to: objE, kind: 'Against' },
        ],
        ports: [{ portId: 'p_c', fromHostId: objC, kind: 'Against' }],
    })

    it('resolves the bare port-to-port edge via two ordinary sequential merges, the second fed the first\'s result as its parent graph --- no single merge ever joins both ends at once (LC10 first/second job)', () => {
        const afterB = collapseCrossingPorts(roomGraphWithAgainst, bGraphWithPort, 'binding_B')
        expect(afterB).toHaveLength(1)
        expect(afterB[0]).toMatchObject({ from: objD, to: { owner: objC, port: 'p_c' }, kind: 'Against' })
        // The bare port-to-port edge is representable as a partial occurrence (P8 clause 3(b)):
        // one real terminal, one still port-qualified, and it type-checks as an ordinary cache
        // edge in its own right, confirming it isn't rejected by the shipped type.
        expect(isEphemeraLudicCacheEdge(afterB[0])).toBe(true)

        // Thread the partial result forward as the next merge's parent graph --- this is the
        // fold's own accumulator step (D1: fold), hand-authored because Slice 3's real walk
        // isn't built yet.
        const { supportedBy: _droppedB, ...rewrittenAfterB } = afterB[0]
        const parentAfterB = testLudicGraph(roomId, { nodes: roomNodes, edges: [rewrittenAfterB] })
        const afterC = collapseCrossingPorts(parentAfterB, cGraphWithPort, 'binding_C')

        expect(afterC).toEqual([
            { tag: 'Relational', from: objD, to: objE, kind: 'Against', supportedBy: [[{ presenceBucketIds: ['PRESENCE#binding_C'], port: 'p_c' }]] },
        ])

        // The order variant: merge C first against the same unmodified parent, then thread that
        // result forward for B. Same final edge either way.
        const afterCFirst = collapseCrossingPorts(roomGraphWithAgainst, cGraphWithPort, 'binding_C')
        expect(afterCFirst).toHaveLength(1)
        expect(afterCFirst[0]).toMatchObject({ from: { owner: objB, port: 'p_b' }, to: objE, kind: 'Against' })

        const { supportedBy: _droppedC, ...rewrittenAfterC } = afterCFirst[0]
        const parentAfterC = testLudicGraph(roomId, { nodes: roomNodes, edges: [rewrittenAfterC] })
        const afterBSecond = collapseCrossingPorts(parentAfterC, bGraphWithPort, 'binding_B')

        expect(afterBSecond).toEqual([
            { tag: 'Relational', from: objD, to: objE, kind: 'Against', supportedBy: [[{ presenceBucketIds: ['PRESENCE#binding_B'], port: 'p_b' }]] },
        ])
    })

    it('does not reconcile two independently-produced partial edges without a shared threaded parent graph --- chain identity, not port matching, is what a join would need, and nothing mints a chainId yet (LC11)', () => {
        const partialViaB = collapseCrossingPorts(roomGraphWithAgainst, bGraphWithPort, 'binding_B')
        const partialViaC = collapseCrossingPorts(roomGraphWithAgainst, cGraphWithPort, 'binding_C')

        // Run independently against the same unmodified parent (not threaded, as the sequential
        // test above does), the two calls never converge: neither half carries a `chainId`, and
        // the two halves don't share a `(from, to, kind)` triple to begin with --- one has D
        // real and C#{p_c} still a port, the other has B#{p_b} still a port and E real --- so
        // `collapsedEdgeIdentityKey` cannot recognize them as the same edge, and nothing else in
        // the shipped code tries. LC11's fork (one entry with two routes, vs two entries) is
        // therefore not decidable by reading this behaviour: the code has no chain-minting path
        // to exercise at all.
        expect(partialViaB).not.toEqual(partialViaC)
        expect(partialViaB[0].chainId).toBeUndefined()
        expect(partialViaC[0].chainId).toBeUndefined()
    })
})
