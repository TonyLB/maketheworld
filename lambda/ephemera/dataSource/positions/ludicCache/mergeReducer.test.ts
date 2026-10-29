/**
 * No shipped writer today constructs a matched pair of crossing-port legs (see
 * `AGENT.presence.planning.md`'s PR-12 Obligation A). Every fixture below is hand-authored --- invented for this test, not read off
 * storage.
 */
import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCrossingPortId, EphemeraLudicGraphComponentNode, EphemeraLudicGraphPort, EphemeraLudicGraphStructureNode, EphemeraLudicRelationalEdgeData, EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { nodesFromPresenceBinding, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { collapseCrossingPorts, collapsedEdgeIdentityKey, foldSameHostBuckets, mergeSameHostBucket } from './mergeReducer'
import { isEphemeraLudicCacheEdge } from './types'
import { parentRemainderKey } from '../ludicGraph/testFixtures'

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

/** The member's own binding into the cover's host, named after the member: a cover entry names
 * which of the MEMBER's bindings is meant, never the covering binding. */
const ownBinding = (host: EphemeraLudicGraphComponentNode['universalKey']) => `PRESENCE#${host}-binding` as EphemeraPresenceNodeId

const enumeratedCover = (...hosts: EphemeraLudicGraphComponentNode['universalKey'][]): EphemeraPresenceCover => ({
    members: hosts.map((host) => ({ host, presence: ownBinding(host) })),
})

/** These fixtures' covers are all Enumerated, whose entries the fold copies; the lookup a Full cover needs is never consulted. */

/** The presence node minted for the binding named `portId` (presenceNodes Slice 3; no port record as of Slice 7a). */
const presenceNode = (portId: string, cover: EphemeraPresenceCover): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: `PRESENCE#${portId}` as EphemeraPresenceNodeId,
    fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }],
    cover,
})

const crossingPort = (portId: EphemeraCrossingPortId, kind: EphemeraLudicGraphPort['kind'] = 'ConnectedTo'): EphemeraLudicGraphPort => ({
    portId,
    fromHostId: roomId,
    kind,
})

const parentLeg = (portId: EphemeraCrossingPortId, kind: EphemeraLudicRelationalEdgeData['kind'] = 'ConnectedTo'): EphemeraLudicRelationalEdgeData => ({
    tag: 'Relational',
    from: boulder,
    to: { owner: boxId, port: portId },
    kind,
} as EphemeraLudicRelationalEdgeData)

const childLeg = (portId: EphemeraCrossingPortId, to: EphemeraLudicRelationalEdgeData['to'], kind: EphemeraLudicRelationalEdgeData['kind'] = 'ConnectedTo'): EphemeraLudicRelationalEdgeData => ({
    tag: 'Relational',
    from: { owner: boxId, port: portId },
    to,
    kind,
} as EphemeraLudicRelationalEdgeData)

describe('collapseCrossingPorts', () => {
    it('collapses a single matched leg pair into one edge with the port terminal rewritten', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('PORT-port_1')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('PORT-port_1', pebble)],
            ports: [crossingPort('PORT-port_1')],
        })

        expect(collapseCrossingPorts(parentGraph, childGraph)).toEqual([
            {
                tag: 'Relational',
                from: boulder,
                to: pebble,
                kind: 'ConnectedTo',
            },
        ])
    })

    it('groups two independently-matched leg pairs landing on the same edge identity, onto one edge', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('PORT-port_1'), parentLeg('PORT-port_2')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('PORT-port_1', pebble), childLeg('PORT-port_2', pebble)],
            ports: [crossingPort('PORT-port_1'), crossingPort('PORT-port_2')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph)
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ from: boulder, to: pebble, kind: 'ConnectedTo' })
    })

    // Slice 3f (ISS8149): `edgeId` used to be missing from the grouping key, so two collapsed
    // edges differing only in `edgeId` merged into one record --- second site of the same defect
    // `legsAgree`'s test above fixes. They must stay two distinct records, not one.
    it('does not group two collapsed edges that agree on (from, to, kind) but disagree on edgeId', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [
                { ...parentLeg('PORT-port_1'), edgeId: 'edge_1' },
                { ...parentLeg('PORT-port_2'), edgeId: 'edge_2' },
            ],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [
                { ...childLeg('PORT-port_1', pebble), edgeId: 'edge_1' },
                { ...childLeg('PORT-port_2', pebble), edgeId: 'edge_2' },
            ],
            ports: [crossingPort('PORT-port_1'), crossingPort('PORT-port_2')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph)
        expect(result).toHaveLength(2)
        expect(result.map((edge) => edge.edgeId).sort()).toEqual(['edge_1', 'edge_2'])
    })

    // The payoff for tagging the exterior address (PN-24), reversed by PNR-2 (Slice 3). One
    // presence binding has two addresses --- its bare node id, and the exterior
    // `{ owner, port: 'PRESENCE#...' }` form --- so two legs reaching the SAME binding by different
    // addresses must land on one cache record, not two records asserting one edge
    // twice. `collapsedEdgeIdentityKey` now normalizes UP to the exterior form (nesting made a
    // binding's cache lookup a path, so the owner must travel with the port id), which is why the
    // surviving record's `to` is the owner-qualified form, not the bare id --- `liftPresenceTerminal`
    // widens the bare leg (`childLeg('PORT-port_1', binding)`) to match the already-qualified one.
    it('dedups two legs reaching one presence binding by its two different addresses', () => {
        const binding = 'PRESENCE#b1' as EphemeraPresenceNodeId
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('PORT-port_1'), parentLeg('PORT-port_2')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, presenceNode('b1', enumeratedCover(boxId))],
            edges: [
                childLeg('PORT-port_1', binding),
                childLeg('PORT-port_2', { owner: boxId, port: binding }),
            ],
            ports: [crossingPort('PORT-port_1'), crossingPort('PORT-port_2')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph)
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ from: boulder, to: { owner: boxId, port: binding }, kind: 'ConnectedTo' })
    })

    // The parent leg's other end is cache-bound too (contract: "Every reference to a binding names its owner"). A bare
    // `PRESENCE#` there is legal in the parent's own graph, but would reach the cache bare, so it
    // is lifted to the exterior form with the parent's host as owner.
    it("lifts a parent leg's bare presence end to the parent's exterior form", () => {
        const parentBinding = 'PRESENCE#p1' as EphemeraPresenceNodeId
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, presenceNode('p1', enumeratedCover(boulder))],
            edges: [{ tag: 'Relational', from: parentBinding, to: { owner: boxId, port: 'PORT-port_1' }, kind: 'ConnectedTo' }],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('PORT-port_1', pebble)],
            ports: [crossingPort('PORT-port_1')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph)
        expect(result).toEqual([
            { tag: 'Relational', from: { owner: roomId, port: parentBinding }, to: pebble, kind: 'ConnectedTo' },
        ])
        expect(result.every((edge) => isEphemeraLudicCacheEdge(edge))).toBe(true)
    })

    it('does not collapse two edges that only coincidentally reach the same identity if their kinds disagree', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('PORT-port_1', 'ConnectedTo')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [{ ...childLeg('PORT-port_1', pebble, 'Custom'), relationLabel: 'tied' } as EphemeraLudicRelationalEdgeData],
            ports: [crossingPort('PORT-port_1')],
        })

        expect(() => collapseCrossingPorts(parentGraph, childGraph)).toThrow(/disagree/)
    })

    it('skips a crossing port with no matching leg on the parent side', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }],
            edges: [],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: feather }],
            edges: [childLeg('PORT-port_1', feather)],
            ports: [crossingPort('PORT-port_1')],
        })

        expect(collapseCrossingPorts(parentGraph, childGraph)).toEqual([])
    })

    // Slice 3f (ISS8149): `edgeId` used to be invisible to `legsAgree`, so two legs carrying
    // different `edgeId` labels collapsed silently, discarding the child leg's label. Nothing
    // mints an `edgeId` yet, so this is a hand-authored pair per the plan's own instruction not
    // to defer on that account.
    it('throws when two legs disagree on edgeId, matching every other identity field it already asserts', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [{ ...parentLeg('PORT-port_1'), edgeId: 'edge_parent' }],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [{ ...childLeg('PORT-port_1', pebble), edgeId: 'edge_child' }],
            ports: [crossingPort('PORT-port_1')],
        })

        expect(() => collapseCrossingPorts(parentGraph, childGraph)).toThrow(/disagree/)
    })
})

describe('mergeSameHostBucket', () => {
    const transitLeg = {
        tag: 'Relational' as const,
        from: { owner: roomId, port: 'PORT-cross_1' as const },
        to: { owner: roomId, port: 'PORT-cross_2' as const },
        kind: 'Custom' as const,
        relationLabel: 'RopedTo',
    }
    const authored = [
        { portId: 'PORT-cross_1' as const, fromHostId: objC, kind: 'Custom' as const, exteriorRelationLabel: 'RopedTo' },
        { portId: 'PORT-cross_2' as const, fromHostId: objD, kind: 'Custom' as const, exteriorRelationLabel: 'RopedTo' },
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

    it('keeps each member\'s hostingKind through the merge', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC, hostingKind: 'On' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC, hostingKind: 'On' }, { tag: 'Object', universalKey: objD, hostingKind: 'In' }],
        })

        const merged = mergeSameHostBucket(bucketA, bucketB)
        expect(merged.hostingKindOf(objC)).toBe('On')
        expect(merged.hostingKindOf(objD)).toBe('In')
    })

    it('still consumes a minted stub matched on both sides', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'STUB-1' }, kind: 'Custom', relationLabel: 'under' }],
            ports: [{ portId: 'STUB-1', fromHostId: objD, kind: 'Custom', exteriorRelationLabel: 'under' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objD }],
            edges: [{ tag: 'Relational', from: { owner: roomId, port: 'STUB-1' }, to: objD, kind: 'Custom', relationLabel: 'under' }],
            ports: [{ portId: 'STUB-1', fromHostId: objC, kind: 'Custom', exteriorRelationLabel: 'under' }],
        })

        const merged = mergeSameHostBucket(bucketA, bucketB)
        expect(merged.relationalEdges).toEqual([{ from: objC, to: objD, kind: 'Custom', relationLabel: 'under' }])
        expect(merged.ports).toEqual([])
    })

    it('does not consume two stub ports that only coincidentally share an id if their legs disagree', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'STUB-1' }, kind: 'Custom', relationLabel: 'under' }],
            ports: [{ portId: 'STUB-1', fromHostId: objD, kind: 'Custom', exteriorRelationLabel: 'under' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objD }],
            edges: [{ tag: 'Relational', from: { owner: roomId, port: 'STUB-1' }, to: objD, kind: 'Custom', relationLabel: 'against' }],
            ports: [{ portId: 'STUB-1', fromHostId: objC, kind: 'Custom', exteriorRelationLabel: 'against' }],
        })

        expect(() => mergeSameHostBucket(bucketA, bucketB)).toThrow(/disagree/)
    })

    it('carries a stub port present in only one bucket forward, unresolved', () => {
        const stubLeg = { tag: 'Relational' as const, from: objC, to: { owner: roomId, port: 'STUB-1' as const }, kind: 'Custom' as const, relationLabel: 'under' }
        const stubPort = { portId: 'STUB-1' as const, fromHostId: objD, kind: 'Custom' as const, exteriorRelationLabel: 'under' }
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [stubLeg],
            ports: [stubPort],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objE2 }],
            edges: [],
            ports: [],
        })

        const merged = mergeSameHostBucket(bucketA, bucketB)
        expect(merged.relationalEdges).toEqual([{ from: stubLeg.from, to: stubLeg.to, kind: 'Custom', relationLabel: 'under' }])
        expect(merged.ports).toEqual([stubPort])
    })
})

describe('foldSameHostBuckets', () => {
    // Three presence buckets on one host. `objC -[Custom: under]-> objD` straddles the adjacent pair
    // (bucket 1/bucket 2). `objE
    // -[Custom: against]-> objF` straddles bucket 1 and bucket 3 with bucket 2 contributing nothing to
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
            { tag: 'Relational', from: objC, to: objD, kind: 'Custom', relationLabel: 'under' },
            { tag: 'Relational', from: objE, to: objF, kind: 'Custom', relationLabel: 'against' },
        ],
    })

    const expectedEdges = [
        { tag: 'Relational', from: objC, to: objD, kind: 'Custom', relationLabel: 'under' },
        { tag: 'Relational', from: objE, to: objF, kind: 'Custom', relationLabel: 'against' },
    ]

    it('reconstructs both interior edges via a single accumulating fold walk, cutting one bucket at a time', () => {
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

    // PR-15 (`presenceSubGraph.ts`): "any edge may land on a presence binding", including one
    // interior to the binding's own host's graph, where the terminal is bare (the graph names the
    // owner implicitly). PNR-2(a)/Slice 3: the cache-bound emission point must still lift it to
    // the exterior form, since lookup in the cache is a path naming the owner explicitly.
    it('lifts a same-host edge landing bare on the host\'s own presence node to the exterior form (PNR-2(a))', () => {
        const bareGraph = testLudicGraph(boxId, {
            nodes: [
                { tag: 'Object', universalKey: boxId },
                { tag: 'Object', universalKey: pebble },
                presenceNode('port_1', enumeratedCover(pebble)),
            ],
            edges: [
                { tag: 'Relational', from: pebble, to: 'PRESENCE#port_1' as EphemeraPresenceNodeId, kind: 'ConnectedTo' },
            ],
        })

        const result = foldSameHostBuckets(bareGraph, ['port_1'])

        expect(result.edges).toEqual([
            { tag: 'Relational', from: pebble, to: { owner: boxId, port: 'PRESENCE#port_1' }, kind: 'ConnectedTo' },
        ])
    })

    it('mints one cache binding per binding folded, with an Enumerated cover copying the graph-side entries, each naming the member\'s own binding (item 3, PN-7/PN-15/PN-19)', () => {
        const result = foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3'])

        expect(result.presenceNodes).toHaveLength(3)
        expect(result.presenceNodes).toEqual(expect.arrayContaining([
            {
                tag: 'Presence',
                universalKey: 'PRESENCE#port_1',
                fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }],
                cover: {
                    members: expect.arrayContaining([
                        { host: charA, presence: ownBinding(charA) },
                        { host: objC, presence: ownBinding(objC) },
                        { host: objE, presence: ownBinding(objE) },
                    ]),
                },
            },
            {
                tag: 'Presence',
                universalKey: 'PRESENCE#port_2',
                fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }],
                cover: {
                    members: expect.arrayContaining([
                        { host: charB, presence: ownBinding(charB) },
                        { host: objD, presence: ownBinding(objD) },
                    ]),
                },
            },
            {
                tag: 'Presence',
                universalKey: 'PRESENCE#port_3',
                fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }],
                cover: {
                    members: expect.arrayContaining([
                        { host: charC, presence: ownBinding(charC) },
                        { host: objF, presence: ownBinding(objF) },
                    ]),
                },
            },
        ]))
    })

    it('mints nothing for a presenceUuid with no matching graph node (degenerate: no node minted, or a stale/legacy binding), given every real binding is otherwise consolidated', () => {
        const result = foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3', 'nonexistent'])

        expect(result.presenceNodes).toHaveLength(3)
        expect(result.presenceNodes.map((node) => node.universalKey).sort()).toEqual([
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
// LC10/LC11 add a peer edge, `OBJECT#D -Custom: against-> OBJECT#E` (E is `PartOf` OBJECT#C only), and
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
        { tag: 'Object' as const, universalKey: objB, hostingKind: 'In' as const },
        { tag: 'Object' as const, universalKey: objC, hostingKind: 'In' as const },
    ]

    // OBJECT#D's two hostings, each interior to its own host's graph and referencing no port.
    const bGraph = testLudicGraph(objB, {
        nodes: [{ tag: 'Object', universalKey: objB }, { tag: 'Object', universalKey: objD, hostingKind: 'In' }],
    })
    const cGraphHostingOnly = testLudicGraph(objC, {
        nodes: [{ tag: 'Object', universalKey: objC }, { tag: 'Object', universalKey: objD, hostingKind: 'In' }, { tag: 'Object', universalKey: objE, hostingKind: 'In' }],
    })
    const roomGraph = testLudicGraph(roomId, { nodes: roomNodes })

    it("produces no join edge for D's hosting from either order, because neither host mints a port for it (LC8 first job, answered in the negative)", () => {
        const mergeB = collapseCrossingPorts(roomGraph, bGraph)
        const mergeC = collapseCrossingPorts(roomGraph, cGraphHostingOnly)

        expect(mergeB).toEqual([])
        expect(mergeC).toEqual([])
        // Order variant: running the merges in the other order, against the same unmodified
        // parent, changes nothing either -- there is no accumulated state for a join to depend
        // on, because there was never a crossing port to begin with.
        expect(collapseCrossingPorts(roomGraph, cGraphHostingOnly)).toEqual(mergeC)
        expect(collapseCrossingPorts(roomGraph, bGraph)).toEqual(mergeB)
    })

    // The peer edge, stated at ROOM#A's level as a boundary crossing between B's and C's exterior
    // ports -- the "routed through B" reading LC10 names, reached without inventing a mediator.
    const roomGraphWithAgainst = testLudicGraph(roomId, {
        nodes: roomNodes,
        edges: [
            { tag: 'Relational', from: { owner: objB, port: 'PORT-p_b' }, to: { owner: objC, port: 'PORT-p_c' }, kind: 'Custom', relationLabel: 'against' },
        ],
    })
    const bGraphWithPort = testLudicGraph(objB, {
        nodes: [{ tag: 'Object', universalKey: objB }, { tag: 'Object', universalKey: objD, hostingKind: 'In' }],
        edges: [
            { tag: 'Relational', from: { owner: objB, port: 'PORT-p_b' }, to: objD, kind: 'Custom', relationLabel: 'against' },
        ],
        ports: [{ portId: 'PORT-p_b', fromHostId: objB, kind: 'Custom', exteriorRelationLabel: 'against' }],
    })
    const cGraphWithPort = testLudicGraph(objC, {
        nodes: [{ tag: 'Object', universalKey: objC }, { tag: 'Object', universalKey: objD, hostingKind: 'In' }, { tag: 'Object', universalKey: objE, hostingKind: 'In' }],
        edges: [
            { tag: 'Relational', from: { owner: objC, port: 'PORT-p_c' }, to: objE, kind: 'Custom', relationLabel: 'against' },
        ],
        ports: [{ portId: 'PORT-p_c', fromHostId: objC, kind: 'Custom', exteriorRelationLabel: 'against' }],
    })

    it('resolves the bare port-to-port edge via two ordinary sequential merges, the second fed the first\'s result as its parent graph --- no single merge ever joins both ends at once (LC10 first/second job)', () => {
        const afterB = collapseCrossingPorts(roomGraphWithAgainst, bGraphWithPort)
        expect(afterB).toHaveLength(1)
        expect(afterB[0]).toMatchObject({ from: objD, to: { owner: objC, port: 'PORT-p_c' }, kind: 'Custom', relationLabel: 'against' })
        // The bare port-to-port edge is representable as a partial occurrence (P8 clause 3(b)):
        // one real terminal, one still port-qualified, and it type-checks as an ordinary cache
        // edge in its own right, confirming it isn't rejected by the shipped type.
        expect(isEphemeraLudicCacheEdge(afterB[0])).toBe(true)

        // Thread the partial result forward as the next merge's parent graph --- this is the
        // fold's own accumulator step (D1: fold), hand-authored because Slice 3's real walk
        // isn't built yet.
        const parentAfterB = testLudicGraph(roomId, { nodes: roomNodes, edges: [afterB[0]] })
        const afterC = collapseCrossingPorts(parentAfterB, cGraphWithPort)

        expect(afterC).toEqual([
            { tag: 'Relational', from: objD, to: objE, kind: 'Custom', relationLabel: 'against' },
        ])

        // The order variant: merge C first against the same unmodified parent, then thread that
        // result forward for B. Same final edge either way.
        const afterCFirst = collapseCrossingPorts(roomGraphWithAgainst, cGraphWithPort)
        expect(afterCFirst).toHaveLength(1)
        expect(afterCFirst[0]).toMatchObject({ from: { owner: objB, port: 'PORT-p_b' }, to: objE, kind: 'Custom', relationLabel: 'against' })

        const parentAfterC = testLudicGraph(roomId, { nodes: roomNodes, edges: [afterCFirst[0]] })
        const afterBSecond = collapseCrossingPorts(parentAfterC, bGraphWithPort)

        expect(afterBSecond).toEqual([
            { tag: 'Relational', from: objD, to: objE, kind: 'Custom', relationLabel: 'against' },
        ])
    })

    it('does not reconcile two independently-produced partial edges without a shared threaded parent graph --- chain identity, not port matching, is what a join would need, and nothing mints a chainId yet (LC11)', () => {
        const partialViaB = collapseCrossingPorts(roomGraphWithAgainst, bGraphWithPort)
        const partialViaC = collapseCrossingPorts(roomGraphWithAgainst, cGraphWithPort)

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

describe('collapsedEdgeIdentityKey: ConnectedTo symmetry', () => {
    const a = { owner: 'OBJECT#Rope' as EphemeraObjectId, port: 'PRESENCE#a' as const }
    const b = { owner: 'OBJECT#Rope' as EphemeraObjectId, port: 'PRESENCE#b' as const }

    it('hashes a ConnectedTo edge alike in either endpoint order', () => {
        expect(collapsedEdgeIdentityKey({ tag: 'Relational', from: a, to: b, kind: 'ConnectedTo' }))
            .toEqual(collapsedEdgeIdentityKey({ tag: 'Relational', from: b, to: a, kind: 'ConnectedTo' }))
    })

    it('keeps Custom directional', () => {
        expect(collapsedEdgeIdentityKey({ tag: 'Relational', from: a, to: b, kind: 'Custom', relationLabel: 'tied to' }))
            .not.toEqual(collapsedEdgeIdentityKey({ tag: 'Relational', from: b, to: a, kind: 'Custom', relationLabel: 'tied to' }))
    })
})
