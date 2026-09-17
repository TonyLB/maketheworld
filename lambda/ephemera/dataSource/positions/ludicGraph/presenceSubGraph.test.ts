/**
 * No shipped writer today constructs a multi-bucket graph or an `EphemeraLudicPortAddress`
 * (see `AGENT.presence.planning.md`'s PR-12 Obligation A). The two- and three-port fixtures below
 * are hand-authored inputs invented for this test, not shapes read off storage --- the
 * multi-bucket cases are the ones the function exists for, but they are untested by anything
 * that would fail if the mechanism were wrong.
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphComponentNode, EphemeraLudicGraphPort, EphemeraLudicGraphStructureNode, EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { testLudicGraph } from './testFixtures'
import { nodesFromPresencePort, nodesFromPresencePorts, subGraphFromNodes } from './presenceSubGraph'

const roomId = 'ROOM#Root' as EphemeraRoomId
const charA = 'CHARACTER#A' as EphemeraCharacterId
const charB = 'CHARACTER#B' as EphemeraCharacterId
const objC = 'OBJECT#C' as EphemeraObjectId
const objD = 'OBJECT#D' as EphemeraObjectId
const objE = 'OBJECT#E' as EphemeraObjectId

const presencePort = (portId: string): EphemeraLudicGraphPort => ({
    portId,
    fromHostId: roomId,
    kind: 'Present',
})

/** An *authored* boundary of the whole, as distinct from a stub minted by a cut. */
const crossingPort = (portId: string): EphemeraLudicGraphPort => ({
    portId,
    fromHostId: objE,
    kind: 'Under',
})

const fullCover: EphemeraPresenceCover = { tag: 'Full' }

/** A dummy `presence` disambiguator per member --- these fixtures don't exercise a covered
 * component's own multiple bindings (PN-22), so any well-formed `PRESENCE#` id suffices. */
const enumeratedCover = (...hosts: EphemeraLudicGraphComponentNode['universalKey'][]): EphemeraPresenceCover => ({
    tag: 'Enumerated',
    members: hosts.map((host) => ({ host, presence: `PRESENCE#${host}-binding` as EphemeraPresenceNodeId })),
})

/** The presence node minted 1:1 with `presencePort(portId)` (presenceNodes Slice 3). */
const presenceNode = (portId: string, cover: EphemeraPresenceCover): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: `PRESENCE#${portId}` as EphemeraPresenceNodeId,
    fromHostId: roomId,
    cover,
})

describe('nodesFromPresencePort', () => {
    it('falls back to full coverage when no presence node matches the port (degenerate: no node minted, or a stale/legacy port)', () => {
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

    it("returns every component node when the presence node's cover is 'Full'", () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objC },
                presenceNode('port_1', fullCover),
            ],
            ports: [presencePort('port_1')],
        })
        expect(nodesFromPresencePort(graph, 'port_1')).toEqual(new Set([roomId, charA, objC]))
    })

    it("excludes presence nodes themselves from a 'Full' cover's node set (PN-6: a presence node is a member of no bucket, present in every cut instead)", () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                presenceNode('port_1', fullCover),
                presenceNode('port_2', fullCover),
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        const result = nodesFromPresencePort(graph, 'port_1')
        expect(result).toEqual(new Set([roomId, objC]))
        expect(result.has('PRESENCE#port_1' as EphemeraPresenceNodeId)).toBe(false)
        expect(result.has('PRESENCE#port_2' as EphemeraPresenceNodeId)).toBe(false)
    })

    it("splits a two-bucket child by port, root included in both, per each presence node's own Enumerated cover", () => {
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
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        expect(nodesFromPresencePort(graph, 'port_1')).toEqual(new Set([roomId, charA, objC]))
        expect(nodesFromPresencePort(graph, 'port_2')).toEqual(new Set([roomId, charB, objD]))
    })

    it('returns just the root when a presence node has an empty Enumerated cover', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                presenceNode('port_1', enumeratedCover(charA)),
                presenceNode('port_2', enumeratedCover()),
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        expect(nodesFromPresencePort(graph, 'port_2')).toEqual(new Set([roomId]))
    })

    it('is keyed on portId, not owner --- two presence nodes on the same host stay independent', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Character', universalKey: charB },
                presenceNode('port_1', enumeratedCover(charA)),
                presenceNode('port_2', enumeratedCover(charB)),
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        expect(nodesFromPresencePort(graph, 'port_1')).not.toContain(charB)
        expect(nodesFromPresencePort(graph, 'port_2')).not.toContain(charA)
    })
})

describe('subGraphFromNodes', () => {
    const bucket = new Set([roomId, charA, objC])

    it('keeps an interior edge unchanged', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objC },
            ],
            edges: [{ tag: 'Relational', from: charA, to: objC, kind: 'Under' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.relationalEdges).toEqual([{ from: charA, to: objC, kind: 'Under' }])
        expect(result.ports).toEqual([])
    })

    it('drops an edge with neither endpoint in the bucket', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Character', universalKey: charB },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: charB, to: objD, kind: 'Under' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.relationalEdges).toEqual([])
        expect(result.ports).toEqual([])
    })

    //
    // This case used to assert the opposite --- that a port-qualified far endpoint is kept whole
    // and mints nothing --- on the premise that such a terminal names a node in some *other*
    // graph. PR-C2 (2026-08-21) settled that it cannot: a boundary-spanning edge "is not one
    // edge" but two, each terminating on its own host's port, so `{ owner: X, port: p }` here is
    // either this host's boundary or a node of this graph naming a port on its own interior. In
    // the latter case it is an ordinary same-host straddle, and leaving it whole is not merely
    // conservative but incoherent: the bucket holding objE would stub its own bare objC end,
    // leaving one unmatched stub and one duplicate edge with nothing to splice them.
    //
    it('mints a stub for a straddle to an in-graph node addressed through its own port', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objE },
            ],
            edges: [{ tag: 'Relational', from: objC, to: { owner: objE, port: 'ext1' }, kind: 'Custom', relationLabel: 'TiedTo' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports).toHaveLength(1)
        const [port] = result.ports
        expect(port).toMatchObject({ fromHostId: objE, kind: 'Custom', exteriorRelationLabel: 'TiedTo' })
        expect(result.relationalEdges).toEqual([
            { from: objC, to: { owner: roomId, port: port.portId }, kind: 'Custom', relationLabel: 'TiedTo' },
        ])
        //
        // The `port` half of the address is not carried on `fromHostId`, which holds owners only
        // --- but it survives in the minted id, which is what lets the bucket holding objE mint
        // the same one and the splice recover the full terminal from the leg that kept it.
        //
        const holdingTo = subGraphFromNodes(graph, new Set([roomId, objE]))
        expect(holdingTo.ports[0].portId).toEqual(port.portId)
        expect(holdingTo.relationalEdges).toEqual([
            { from: { owner: roomId, port: port.portId }, to: { owner: objE, port: 'ext1' }, kind: 'Custom', relationLabel: 'TiedTo' },
        ])
    })

    it('throws on a terminal owner that is neither the root nor a node of the graph', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
            ],
            edges: [{ tag: 'Relational', from: objC, to: { owner: objE, port: 'ext1' }, kind: 'Custom', relationLabel: 'TiedTo' }],
        })
        expect(() => subGraphFromNodes(graph, bucket)).toThrow(/neither the root nor a node/)
    })

    //
    // The root is neutral in both of its guises, and these two cases are the same case: the
    // owner-based classification read each of them as *in*, called the edge a straddle, and minted
    // a port for a crossing that was never crossing anything. Nothing is lost by excluding them
    // --- objD's own bucket carries each edge whole, both terminals real.
    //
    it('excludes a hosting edge to a node outside the bucket rather than minting a stub', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: objD, to: roomId, kind: 'In' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.relationalEdges).toEqual([])
        expect(result.ports).toEqual([])
    })

    it("excludes a peer edge from the host's own port to a node outside the bucket", () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            ports: [crossingPort('cross_1')],
            edges: [{ tag: 'Relational', from: { owner: roomId, port: 'cross_1' }, to: objD, kind: 'Under' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.relationalEdges).toEqual([])
        expect(result.ports.filter((port) => port.kind !== 'Present')).toEqual([])
    })

    it('keeps a hosting edge to the root, and a peer edge out through a port, for a node in the bucket', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
            ],
            ports: [crossingPort('cross_1')],
            edges: [
                { tag: 'Relational', from: objC, to: roomId, kind: 'In' },
                { tag: 'Relational', from: objC, to: { owner: roomId, port: 'cross_1' }, kind: 'Under' },
            ],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.relationalEdges).toEqual([
            { from: objC, to: roomId, kind: 'In' },
            { from: objC, to: { owner: roomId, port: 'cross_1' }, kind: 'Under' },
        ])
        expect(result.ports).toEqual([crossingPort('cross_1')])
    })

    //
    // LC10: a leg entering through one port and leaving through another without touching a node
    // of this host (the lever-and-boiler shape). Two neutral endpoints, so no bucket owns it and
    // every bucket keeps it. It survived the owner-based classification too, but only by accident
    // --- both terminals resolved to the root and read as interior.
    //
    it('keeps a port-to-port transit leg in every bucket, minting nothing', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            ports: [crossingPort('cross_1'), crossingPort('cross_2')],
            edges: [{
                tag: 'Relational',
                from: { owner: roomId, port: 'cross_1' },
                to: { owner: roomId, port: 'cross_2' },
                kind: 'Custom',
                relationLabel: 'RopedTo',
            }],
        })
        const transitLeg = {
            from: { owner: roomId, port: 'cross_1' },
            to: { owner: roomId, port: 'cross_2' },
            kind: 'Custom',
            relationLabel: 'RopedTo',
        }
        expect(subGraphFromNodes(graph, bucket).relationalEdges).toEqual([transitLeg])
        expect(subGraphFromNodes(graph, new Set([roomId, objD])).relationalEdges).toEqual([transitLeg])
        expect(subGraphFromNodes(graph, bucket).ports.filter((port) => port.kind !== 'Present')).toEqual([
            crossingPort('cross_1'),
            crossingPort('cross_2'),
        ])
    })

    it('carries an authored crossing port into a bucket whose edges name it', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
            ],
            ports: [crossingPort('cross_1')],
            edges: [{ tag: 'Relational', from: objC, to: { owner: roomId, port: 'cross_1' }, kind: 'Under' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports).toEqual([crossingPort('cross_1')])
    })

    //
    // Referenced, not wholesale. A boundary no surviving edge reaches bounds nothing in this
    // bucket, and carrying it would assert a crossing this bucket does not have --- and would
    // hand the same-host merge a port present on both sides with no leg to splice.
    //
    it('does not carry an authored crossing port no surviving edge names', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            ports: [crossingPort('cross_1'), crossingPort('cross_2')],
            edges: [
                { tag: 'Relational', from: objC, to: { owner: roomId, port: 'cross_1' }, kind: 'Under' },
                { tag: 'Relational', from: objD, to: { owner: roomId, port: 'cross_2' }, kind: 'Under' },
            ],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports).toEqual([crossingPort('cross_1')])
    })

    it("mints a stub port for PR-C1's intra-graph straddle (bare id, no port at the cut)", () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: objC, to: objD, kind: 'Under' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports).toHaveLength(1)
        const [port] = result.ports
        expect(port).toMatchObject({ fromHostId: objD, kind: 'Under' })
        expect(result.relationalEdges).toEqual([
            { from: objC, to: { owner: roomId, port: port.portId }, kind: 'Under' },
        ])
    })

    it('mints two distinct ports for two edges straddling to the same external node', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [
                { tag: 'Relational', from: objC, to: objD, kind: 'Under' },
                { tag: 'Relational', from: charA, to: objD, kind: 'Against' },
            ],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports).toHaveLength(2)
        expect(result.ports[0].portId).not.toEqual(result.ports[1].portId)
    })

    it('mints the identical port id when the same graph and bucket are derived twice', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: objC, to: objD, kind: 'Under' }],
        })
        const first = subGraphFromNodes(graph, bucket)
        const second = subGraphFromNodes(graph, bucket)
        expect(first.ports[0].portId).toEqual(second.ports[0].portId)
    })

    it('prefixes a minted stub id with STUB-, so the merge can tell it from an authored crossing port', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: objC, to: objD, kind: 'Under' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports[0].portId.startsWith('STUB-')).toBe(true)
    })

    it('keys a chain-bearing straddle on its chainId --- at most one leg of a chain per host', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: objC, to: objD, kind: 'Under', chainId: 'rope1' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports[0].portId).toEqual('STUB-rope1')
    })

    it('mints the same chain-keyed id from both sides of the cut, each bucket seeing only its own half', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: objC, to: objD, kind: 'Under', chainId: 'rope1' }],
        })
        const holdingFrom = subGraphFromNodes(graph, new Set([roomId, objC]))
        const holdingTo = subGraphFromNodes(graph, new Set([roomId, objD]))
        expect(holdingFrom.ports[0].portId).toEqual(holdingTo.ports[0].portId)
        //
        // The halves differ only in which real terminal survives --- which is what makes the
        // shared id the whole matching mechanism.
        //
        expect(holdingFrom.relationalEdges).toEqual([
            { from: objC, to: { owner: roomId, port: 'STUB-rope1' }, kind: 'Under', chainId: 'rope1' },
        ])
        expect(holdingTo.relationalEdges).toEqual([
            { from: { owner: roomId, port: 'STUB-rope1' }, to: objD, kind: 'Under', chainId: 'rope1' },
        ])
    })

    it('throws when two straddling edges in one cut mint the same stub id', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [
                { tag: 'Relational', from: objC, to: objD, kind: 'Under', chainId: 'rope1' },
                { tag: 'Relational', from: charA, to: objD, kind: 'Against', chainId: 'rope1' },
            ],
        })
        expect(() => subGraphFromNodes(graph, bucket)).toThrow(/same stub port id STUB-rope1/)
    })

    it('carries the relationLabel into exteriorRelationLabel for a Custom-kind straddle', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Object', universalKey: objD },
            ],
            edges: [{ tag: 'Relational', from: objC, to: objD, kind: 'Custom', relationLabel: 'TiedTo' }],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports[0]).toMatchObject({ kind: 'Custom', exteriorRelationLabel: 'TiedTo' })
    })

    it('is a well-formed graph on the same host, with the root present', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
            ],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.hostId).toEqual(graph.hostId)
        expect(result.rootId).toEqual(graph.rootId)
        expect(result.nodeIds.has(roomId)).toBe(true)
    })

    // `'excludes an interior Present edge from the output entirely (LR-6)'` and `'does not mint
    // a stub port for a Present edge straddling into a different bucket (LR-6)'` deleted at
    // presenceNodes Slice 3: no `Present`-kind edge is ever constructed by any writer, so there
    // is nothing left for the (now-deleted) `contentEdges` filter to exclude or straddle.

    it("preserves all of the graph's own presence ports regardless of bucket (LR-6)", () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Character', universalKey: charB },
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        const result = subGraphFromNodes(graph, bucket)
        expect(result.ports).toEqual(
            expect.arrayContaining([presencePort('port_1'), presencePort('port_2')])
        )
        expect(result.ports).toHaveLength(2)
    })

    it("preserves all of the graph's own presence nodes regardless of bucket (PN-6, Slice 3: a presence node is present in every cut)", () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Object', universalKey: objC },
                { tag: 'Character', universalKey: charB },
                presenceNode('port_1', fullCover),
                presenceNode('port_2', enumeratedCover(charB)),
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        // `bucket` (roomId, charA, objC) doesn't even name charB, and port_2's own cover is
        // Enumerated over charB alone --- neither is relevant, since presence nodes are carried
        // unconditionally rather than filtered by bucket membership.
        const result = subGraphFromNodes(graph, bucket)
        expect(result.nodeIds.has('PRESENCE#port_1' as EphemeraPresenceNodeId)).toBe(true)
        expect(result.nodeIds.has('PRESENCE#port_2' as EphemeraPresenceNodeId)).toBe(true)
    })
})

describe('nodesFromPresencePorts', () => {
    it('unions two buckets, the shared root included only once', () => {
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
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        const union = nodesFromPresencePorts(graph, ['port_1', 'port_2'])
        expect(union).toEqual(new Set([roomId, charA, objC, charB, objD]))
    })

    it('composes to the same set as nodesFromPresencePort alone, given a single portId', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objC },
                presenceNode('port_1', enumeratedCover(charA, objC)),
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
        })
        expect(nodesFromPresencePorts(graph, ['port_1'])).toEqual(nodesFromPresencePort(graph, 'port_1'))
    })

    it('feeding the union into subGraphFromNodes needs no stub port for an edge between two different buckets', () => {
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Room', universalKey: roomId },
                { tag: 'Character', universalKey: charA },
                { tag: 'Object', universalKey: objD },
                { tag: 'Object', universalKey: objE },
                presenceNode('port_1', enumeratedCover(charA)),
                presenceNode('port_2', enumeratedCover(objD)),
            ],
            ports: [presencePort('port_1'), presencePort('port_2')],
            edges: [
                // A content edge straddling the two buckets --- interior once they're unioned.
                { tag: 'Relational', from: charA, to: objD, kind: 'Under' },
                // A content edge to a node genuinely outside both buckets --- still a straddle.
                { tag: 'Relational', from: charA, to: objE, kind: 'Against' },
            ],
        })
        const union = nodesFromPresencePorts(graph, ['port_1', 'port_2'])
        const result = subGraphFromNodes(graph, union)

        expect(result.relationalEdges).toEqual(
            expect.arrayContaining([{ from: charA, to: objD, kind: 'Under' }])
        )
        const straddleEdge = result.relationalEdges.find((edge) => edge.kind === 'Against')
        expect(straddleEdge).toBeDefined()
        expect(typeof straddleEdge?.to).not.toBe('string')
        // Exactly one minted port --- the genuine straddle to objE, not the charA/objD edge.
        expect(result.ports.filter((port) => port.kind !== 'Present')).toHaveLength(1)
    })
})
