/**
 * No shipped writer today constructs a matched pair of crossing-port legs (see
 * `AGENT.presence.planning.md`'s PR-12 Obligation A). Every fixture below is hand-authored --- invented for this test, not read off
 * storage.
 */
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphPort, EphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { testLudicGraph } from '../ludicGraph/testFixtures'
import { collapseCrossingPorts } from './mergeReducer'

const roomId = 'ROOM#Root' as EphemeraRoomId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const boulder = 'OBJECT#Boulder' as EphemeraObjectId
const pebble = 'OBJECT#Pebble' as EphemeraObjectId
const feather = 'OBJECT#Feather' as EphemeraObjectId

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
