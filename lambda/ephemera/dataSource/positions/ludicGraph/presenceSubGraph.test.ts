/**
 * No shipped writer today constructs a multi-bucket graph or an `EphemeraLudicPortAddress`
 * (see AGENT.ludicCacheReducer.planning.md's finding). The two- and three-port fixtures below
 * are hand-authored inputs invented for this test, not shapes read off storage --- the
 * multi-bucket cases are the ones the function exists for, but they are untested by anything
 * that would fail if the mechanism were wrong.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphPort, EphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { testLudicGraph } from './testFixtures'
import { nodesFromPresencePort } from './presenceSubGraph'

const roomId = 'ROOM#Root' as EphemeraRoomId
const charA = 'CHARACTER#A' as EphemeraCharacterId
const charB = 'CHARACTER#B' as EphemeraCharacterId
const objC = 'OBJECT#C' as EphemeraObjectId
const objD = 'OBJECT#D' as EphemeraObjectId

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

describe('nodesFromPresencePort', () => {
    it('returns every node when the graph has no presence ports (degenerate, zero-port arm)', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objC },
            ],
            ports: [],
        })
        expect(nodesFromPresencePort(graph, 'nonexistent')).toEqual(new Set([roomId, charA, objC]))
    })

    it('returns every node when the graph has exactly one presence port, regardless of Present edges', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objC },
            ],
            ports: [presencePort('port_1')],
        })
        expect(nodesFromPresencePort(graph, 'port_1')).toEqual(new Set([roomId, charA, objC]))
    })

    it('splits a two-bucket child by port, root included in both', () => {
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
            ],
        })
        expect(nodesFromPresencePort(graph, 'port_1')).toEqual(new Set([roomId, charA, objC]))
        expect(nodesFromPresencePort(graph, 'port_2')).toEqual(new Set([roomId, charB, objD]))
    })

    it('returns just the root when a presence port (in a multi-port graph) has no outgoing Present edge', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
            edges: [presentEdge('port_1', charA)],
        })
        expect(nodesFromPresencePort(graph, 'port_2')).toEqual(new Set([roomId]))
    })

    it('resolves a port-qualified to endpoint to its owning node', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
            edges: [
                presentEdge('port_1', { owner: objC, port: 'inner' }),
                presentEdge('port_2', objD),
            ],
        })
        expect(nodesFromPresencePort(graph, 'port_1')).toEqual(new Set([roomId, objC]))
    })

    it('is keyed on portId, not owner --- a Present edge from a different port on the same owner is not picked up', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Character', universalKey: charB },
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
            edges: [presentEdge('port_1', charA), presentEdge('port_2', charB)],
        })
        expect(nodesFromPresencePort(graph, 'port_1')).not.toContain(charB)
        expect(nodesFromPresencePort(graph, 'port_2')).not.toContain(charA)
    })
})
