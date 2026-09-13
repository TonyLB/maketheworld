/**
 * No shipped writer today constructs a matched pair of crossing-port legs (see
 * `AGENT.presence.planning.md`'s PR-12 Obligation A). Every fixture below is hand-authored --- invented for this test, not read off
 * storage.
 */
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphPort, EphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { nodesFromPresencePort, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import { testLudicGraph } from '../ludicGraph/testFixtures'
import { collapseCrossingPorts, collapseSameHostStubs, foldSameHostBuckets } from './mergeReducer'

const roomId = 'ROOM#Root' as EphemeraRoomId
const boxId = 'OBJECT#Box' as EphemeraObjectId
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

const presencePort = (portId: string): EphemeraLudicGraphPort => ({
    portId,
    fromHostId: roomId,
    kind: 'Present',
})

const presentEdge = (portId: string, to: EphemeraLudicRelationalEdgeData['to']): EphemeraLudicRelationalEdgeData => ({
    tag: 'Relational',
    from: { owner: roomId, port: portId },
    to,
    kind: 'Present',
})

const crossingPort = (portId: string, kind: EphemeraLudicGraphPort['kind'] = 'On'): EphemeraLudicGraphPort => ({
    portId,
    fromHostId: roomId,
    kind: kind as Exclude<EphemeraLudicGraphPort['kind'], 'Present'>,
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
    it('collapses a single matched leg pair into one edge with a one-hop chain', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('port_1')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('port_1', pebble)],
            ports: [crossingPort('port_1')],
        })

        expect(collapseCrossingPorts(parentGraph, childGraph)).toEqual([
            {
                tag: 'Relational',
                from: boulder,
                to: pebble,
                kind: 'On',
                chains: [[boxId]],
            },
        ])
    })

    it('groups two independently-matched leg pairs landing on the same edge identity, without merging their chains', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: boulder }],
            edges: [parentLeg('port_1'), parentLeg('port_2')],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [childLeg('port_1', pebble), childLeg('port_2', pebble)],
            ports: [crossingPort('port_1'), crossingPort('port_2')],
        })

        const result = collapseCrossingPorts(parentGraph, childGraph)
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ from: boulder, to: pebble, kind: 'On' })
        expect(result[0].chains).toEqual([[boxId], [boxId]])
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

        expect(() => collapseCrossingPorts(parentGraph, childGraph)).toThrow(/disagree/)
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

        expect(collapseCrossingPorts(parentGraph, childGraph)).toEqual([])
    })

    it('ignores presence ports entirely', () => {
        const parentGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }],
            edges: [],
        })
        const childGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }],
            edges: [],
            ports: [{ portId: 'presence_1', fromHostId: roomId, kind: 'Present' }],
        })

        expect(collapseCrossingPorts(parentGraph, childGraph)).toEqual([])
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
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
            edges: [
                presentEdge('port_1', charA),
                presentEdge('port_1', objC),
                presentEdge('port_2', charB),
                presentEdge('port_2', objD),
                { tag: 'Relational', from: objC, to: objD, kind: 'Under' },
            ],
        })

        // The naive fold move: cut each bucket alone (rather than unioning first), producing
        // two independently stub-ported halves of the same interior edge --- the case
        // `nodesFromPresencePorts`'s own doc comment names as needing "its own reconciliation
        // step". Confirmed target behavior (union-then-cut needs no such step) is already
        // covered by presenceSubGraph.test.ts's "feeding the union into subGraphFromNodes"
        // case; this is the separate-cuts path a fold would actually produce.
        const bucketA = subGraphFromNodes(graph, nodesFromPresencePort(graph, 'port_1'))
        const bucketB = subGraphFromNodes(graph, nodesFromPresencePort(graph, 'port_2'))

        expect(bucketA.ports.filter((port) => port.kind !== 'Present')).toHaveLength(1)
        expect(bucketB.ports.filter((port) => port.kind !== 'Present')).toHaveLength(1)

        expect(collapseSameHostStubs(bucketA, bucketB)).toEqual([
            { tag: 'Relational', from: objC, to: objD, kind: 'Under', chains: [] },
        ])
    })

    it('does not collapse two stub ports that only coincidentally share an id if their legs disagree', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'stub_1' }, kind: 'Under' }],
            ports: [{ portId: 'stub_1', fromHostId: objD, kind: 'Under' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objD }],
            edges: [{ tag: 'Relational', from: { owner: roomId, port: 'stub_1' }, to: objD, kind: 'Against' }],
            ports: [{ portId: 'stub_1', fromHostId: objC, kind: 'Against' }],
        })

        expect(() => collapseSameHostStubs(bucketA, bucketB)).toThrow(/disagree/)
    })

    it('skips a stub port present in only one bucket', () => {
        const bucketA = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objC }],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'stub_1' }, kind: 'Under' }],
            ports: [{ portId: 'stub_1', fromHostId: objD, kind: 'Under' }],
        })
        const bucketB = testLudicGraph(roomId, {
            nodes: [{ tag: 'Room', universalKey: roomId }, { tag: 'Object', universalKey: objE2 }],
            edges: [],
            ports: [],
        })

        expect(collapseSameHostStubs(bucketA, bucketB)).toEqual([])
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
        ],
        ports: [presencePort('port_1'), presencePort('port_2'), presencePort('port_3')],
        edges: [
            presentEdge('port_1', charA),
            presentEdge('port_1', objC),
            presentEdge('port_1', objE),
            presentEdge('port_2', charB),
            presentEdge('port_2', objD),
            presentEdge('port_3', charC),
            presentEdge('port_3', objF),
            { tag: 'Relational', from: objC, to: objD, kind: 'Under' },
            { tag: 'Relational', from: objE, to: objF, kind: 'Against' },
        ],
    })

    const expectedEdges = [
        { tag: 'Relational', from: objC, to: objD, kind: 'Under', chains: [] },
        { tag: 'Relational', from: objE, to: objF, kind: 'Against', chains: [] },
    ]

    it('reconstructs both interior edges via the existing pairwise primitive, cutting every bucket up front (two-pass baseline, using only shipped code)', () => {
        const bucketA = subGraphFromNodes(graph, nodesFromPresencePort(graph, 'port_1'))
        const bucketB = subGraphFromNodes(graph, nodesFromPresencePort(graph, 'port_2'))
        const bucketC = subGraphFromNodes(graph, nodesFromPresencePort(graph, 'port_3'))

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

        expect(result).toHaveLength(2)
        expect(result).toEqual(expect.arrayContaining(expectedEdges))
    })

    it('does not depend on the order buckets are visited in --- a still-open stub is carried in the walk\'s own state, not compared only to the immediately preceding bucket', () => {
        const forward = foldSameHostBuckets(graph, ['port_1', 'port_2', 'port_3'])
        const shuffled = foldSameHostBuckets(graph, ['port_3', 'port_1', 'port_2'])

        expect(forward).toHaveLength(2)
        expect(shuffled).toHaveLength(2)
        expect(forward).toEqual(expect.arrayContaining(expectedEdges))
        expect(shuffled).toEqual(expect.arrayContaining(expectedEdges))
    })
})
