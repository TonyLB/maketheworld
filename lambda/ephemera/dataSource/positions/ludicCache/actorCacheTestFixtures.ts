/**
 * Test fixture for the actor's cache (ISS8314, `AGENT.actorCache.planning.md`): a room with a table, and an
 * actor standing in it who holds a bag with a coin in it, plus a rope bound twice (one binding in hand, one tied
 * to the table). The room's graph holds no character (a bystander is not in its room's graph), so a room walk
 * never reaches the bag or the coin; a walk seeded at the actor does.
 *
 * Crossing: the actor holds a leg `rope -ConnectedTo-> bag.PORT-held` and the bag holds `PORT-held -ConnectedTo-> coin`,
 * so the actor's fold collapses one crossing edge `rope -> coin`.
 *
 * `actorCrossingGraphs` (see the positions contract, "Cache edges keep unmatched crossing legs") adds character-to-room crossings: the actor and a
 * second character are participants, so each has a node in the room's graph, and the table is tied across each one's
 * boundary (`table -[tied to]-> actor.PORT-tether`, then `PORT-tether -[tied to]-> bag`; likewise to the other's leash).
 */
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../ludicGraph/testFixtures'

export const roomId = 'ROOM#Kitchen' as EphemeraRoomId
export const actorId = 'CHARACTER#Actor' as EphemeraCharacterId
export const tableId = 'OBJECT#Table' as EphemeraObjectId
export const lampId = 'OBJECT#Lamp' as EphemeraObjectId
export const bagId = 'OBJECT#Bag' as EphemeraObjectId
export const coinId = 'OBJECT#Coin' as EphemeraObjectId
export const ropeId = 'OBJECT#Rope' as EphemeraObjectId
export const otherId = 'CHARACTER#Other' as EphemeraCharacterId
export const leashId = 'OBJECT#Leash' as EphemeraObjectId

export const actorInRoom = PresenceKey('actor-in-room')
export const tableInRoom = PresenceKey('table-in-room')
export const lampOnTable = PresenceKey('lamp-on-table')
export const bagHeld = PresenceKey('bag-held')
export const coinInBag = PresenceKey('coin-in-bag')
export const ropeHeld = PresenceKey('rope-held')
export const ropeAtTable = PresenceKey('rope-at-table')
export const otherInRoom = PresenceKey('other-in-room')
export const leashHeld = PresenceKey('leash-held')

const cover = (...entries: [EphemeraMembershipHostId, string][]): EphemeraPresenceCover => ({
    members: entries.map(([host, presence]) => ({ host, presence: presence as EphemeraPresenceCover['members'][number]['presence'] })),
})

/** The room row's world: what a room-seeded walk reads. The actor's graph is deliberately absent from the room's nodes. */
export const actorCacheGraphs = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    [roomId, testLudicGraph(roomId, {
        nodes: [
            { tag: 'Room', universalKey: roomId },
            { tag: 'Object', universalKey: tableId },
            presenceBindingNode(parentRemainderKey(roomId), undefined, cover([tableId, tableInRoom])),
        ],
    })],
    [tableId, testLudicGraph(tableId, {
        nodes: [
            { tag: 'Object', universalKey: tableId },
            { tag: 'Object', universalKey: lampId },
            { tag: 'Object', universalKey: ropeId },
            presenceBindingNode(tableInRoom, roomId, cover([lampId, lampOnTable], [ropeId, ropeAtTable])),
        ],
        edges: [{ tag: 'Relational', from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'is near' }],
    })],
    [lampId, testLudicGraph(lampId, { nodes: [{ tag: 'Object', universalKey: lampId }, presenceBindingNode(lampOnTable, { host: tableId, presence: tableInRoom })] })],
    // Half-held: one binding of the rope is in hand, the other is tied to the table.
    [ropeId, testLudicGraph(ropeId, {
        nodes: [
            { tag: 'Object', universalKey: ropeId },
            presenceBindingNode(ropeAtTable, { host: tableId, presence: tableInRoom }),
            presenceBindingNode(ropeHeld, { host: actorId, presence: actorInRoom }),
        ],
    })],
    [actorId, testLudicGraph(actorId, {
        nodes: [
            { tag: 'Character', universalKey: actorId },
            { tag: 'Object', universalKey: bagId },
            { tag: 'Object', universalKey: ropeId },
            presenceBindingNode(actorInRoom, roomId, cover([bagId, bagHeld], [ropeId, ropeHeld])),
        ],
        edges: [{ tag: 'Relational', from: ropeId, to: { owner: bagId, port: 'PORT-held' }, kind: 'ConnectedTo' }],
    })],
    [bagId, testLudicGraph(bagId, {
        nodes: [
            { tag: 'Object', universalKey: bagId },
            { tag: 'Object', universalKey: coinId },
            presenceBindingNode(bagHeld, { host: actorId, presence: actorInRoom }, cover([coinId, coinInBag])),
        ],
        edges: [{ tag: 'Relational', from: { owner: bagId, port: 'PORT-held' }, to: coinId, kind: 'ConnectedTo' }],
        ports: [{ portId: 'PORT-held', fromHostId: actorId, kind: 'ConnectedTo' }],
    })],
    [coinId, testLudicGraph(coinId, { nodes: [{ tag: 'Object', universalKey: coinId }, presenceBindingNode(coinInBag, { host: bagId, presence: bagHeld })] })],
])

const tiedTo = { kind: 'Custom', relationLabel: 'tied to' } as const
export const tetherPort = { owner: actorId, port: 'PORT-tether' } as const
export const leashPort = { owner: otherId, port: 'PORT-leash' } as const

/**
 * `actorCacheGraphs` with two character-to-room crossings. The actor and the other character are participants: each
 * has a node in the room's graph, covered by the room's Base, so the room's leg has a node to land on. Each crossing's
 * port is the character's own (the interior mints it), so the room holds the leg to the port and the character holds
 * the leg from it.
 */
export const actorCrossingGraphs = (): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    ...actorCacheGraphs(),
    [roomId, testLudicGraph(roomId, {
        nodes: [
            { tag: 'Room', universalKey: roomId },
            { tag: 'Object', universalKey: tableId },
            { tag: 'Character', universalKey: actorId },
            { tag: 'Character', universalKey: otherId },
            presenceBindingNode(parentRemainderKey(roomId), undefined, cover([tableId, tableInRoom], [actorId, actorInRoom], [otherId, otherInRoom])),
        ],
        edges: [
            { tag: 'Relational', from: tableId, to: tetherPort, ...tiedTo },
            { tag: 'Relational', from: tableId, to: leashPort, ...tiedTo },
        ],
    })],
    [actorId, testLudicGraph(actorId, {
        nodes: [
            { tag: 'Character', universalKey: actorId },
            { tag: 'Object', universalKey: bagId },
            { tag: 'Object', universalKey: ropeId },
            presenceBindingNode(actorInRoom, roomId, cover([bagId, bagHeld], [ropeId, ropeHeld])),
        ],
        edges: [
            { tag: 'Relational', from: ropeId, to: { owner: bagId, port: 'PORT-held' }, kind: 'ConnectedTo' },
            { tag: 'Relational', from: tetherPort, to: bagId, ...tiedTo },
        ],
        ports: [{ portId: 'PORT-tether', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'tied to' }],
    })],
    [otherId, testLudicGraph(otherId, {
        nodes: [
            { tag: 'Character', universalKey: otherId },
            { tag: 'Object', universalKey: leashId },
            presenceBindingNode(otherInRoom, roomId, cover([leashId, leashHeld])),
        ],
        edges: [{ tag: 'Relational', from: leashPort, to: leashId, ...tiedTo }],
        ports: [{ portId: 'PORT-leash', fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'tied to' }],
    })],
    [leashId, testLudicGraph(leashId, { nodes: [{ tag: 'Object', universalKey: leashId }, presenceBindingNode(leashHeld, { host: otherId, presence: otherInRoom })] })],
])

export const graphReader = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>) => async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => {
    const graph = graphs.get(hostId)
    if (!graph) {
        throw new Error(`No fixture graph for ${hostId}`)
    }
    return graph
}
