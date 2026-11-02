/**
 * The Kitchen (corpus scenes 6 and 9), and the actor's-cache fixture world (ISS8314): `actorCacheTestFixtures.ts`
 * re-exports this world, so the scenes and the actor's-cache tests read one definition.
 *
 * A room with a table, and an actor standing in it who holds a bag with a coin in it, plus a rope bound twice (one
 * binding in hand, one on the table). The room's graph holds no character (a bystander is not in its room's graph), so a
 * room walk never reaches the bag or the coin; a walk seeded at the actor does.
 *
 * Crossing: the actor holds a leg `rope -[tied to]-> bag.PORT-held` and the bag holds `PORT-held -[tied to]-> coin`,
 * so the actor's fold collapses one crossing edge `rope -> coin`. A `Custom` relation, not `ConnectedTo`: the rope and the coin
 * are separate wholes, and `ConnectedTo` is legal only inside one whole (positions contract).
 *
 * `kitchenCrossingGraphs` (see the positions contract, "Cache edges keep unmatched crossing legs") adds character-to-room
 * crossings: the actor and a second character are participants, so each has a node in the room's graph, and the table is
 * tied across each one's boundary (`table -[tied to]-> actor.PORT-tether`, then `PORT-tether -[tied to]-> bag`; likewise to
 * the other's leash). The other's shard is never expanded, so that leg stays open.
 */
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { nodeFromId } from '../../ludicGraph'
import { binding, characterId, hostGraph, member, objectId, presence, roomId as roomIdOf, type SceneFixture } from './worldBuilders'

export const roomId = roomIdOf('Kitchen')
export const actorId = characterId('Actor')
export const tableId = objectId('Table')
export const lampId = objectId('Lamp')
export const bagId = objectId('Bag')
export const coinId = objectId('Coin')
export const ropeId = objectId('Rope')
export const otherId = characterId('Other')
export const leashId = objectId('Leash')

export const actorInRoom = presence('actor-in-room')
export const tableInRoom = presence('table-in-room')
export const lampOnTable = presence('lamp-on-table')
export const bagHeld = presence('bag-held')
export const coinInBag = presence('coin-in-bag')
export const ropeHeld = presence('rope-held')
export const ropeAtTable = presence('rope-at-table')
export const otherInRoom = presence('other-in-room')
export const leashHeld = presence('leash-held')

export const tetherPort = { owner: actorId, port: 'PORT-tether' } as const
export const leashPort = { owner: otherId, port: 'PORT-leash' } as const

const tiedTo = { kind: 'Custom', relationLabel: 'tied to' } as const
const heldPort = { owner: bagId, port: 'PORT-held' } as const

type Graphs = [EphemeraMembershipHostId, EphemeraLudicGraphFieldPayload][]

/** The room row's world: what a room-seeded walk reads. The actor's graph is deliberately absent from the room's nodes. */
export const kitchenGraphs = (): Graphs => [
    hostGraph(roomId, [member(tableId, 'In'), binding('Base', [], [[tableId, 'table-in-room']])]),
    hostGraph(tableId, [
        member(lampId, 'On'), member(ropeId, 'On'),
        binding('table-in-room', [[roomId, 'Base']], [[lampId, 'lamp-on-table'], [ropeId, 'rope-at-table']]),
    ], {
        edges: [{ tag: 'Relational', from: lampId, to: ropeId, kind: 'Custom', relationLabel: 'is near' }],
    }),
    hostGraph(lampId, [binding('lamp-on-table', [[tableId, 'table-in-room']])]),
    // Half-held: one binding of the rope is in hand, the other is on the table.
    hostGraph(ropeId, [
        binding('rope-at-table', [[tableId, 'table-in-room']]),
        binding('rope-held', [[actorId, 'actor-in-room']]),
    ]),
    hostGraph(actorId, [
        member(bagId, 'Held'), member(ropeId, 'Held'),
        binding('actor-in-room', [[roomId, 'Base']], [[bagId, 'bag-held'], [ropeId, 'rope-held']]),
    ], {
        edges: [{ tag: 'Relational', from: ropeId, to: heldPort, ...tiedTo }],
    }),
    hostGraph(bagId, [
        member(coinId, 'In'),
        binding('bag-held', [[actorId, 'actor-in-room']], [[coinId, 'coin-in-bag']]),
    ], {
        edges: [{ tag: 'Relational', from: heldPort, to: coinId, ...tiedTo }],
        ports: [{ portId: heldPort.port, fromHostId: actorId, kind: 'Custom', exteriorRelationLabel: 'tied to' }],
    }),
    hostGraph(coinId, [binding('coin-in-bag', [[bagId, 'bag-held']])]),
]

/**
 * `kitchenGraphs` with two character-to-room crossings. The actor and the other character are participants: each
 * has a node in the room's graph, covered by the room's Base, so the room's leg has a node to land on. Each crossing's
 * port is the character's own (the interior mints it), so the room holds the leg to the port and the character holds
 * the leg from it.
 */
export const kitchenCrossingGraphs = (): Graphs => [...new Map<EphemeraMembershipHostId, EphemeraLudicGraphFieldPayload>([
    ...kitchenGraphs(),
    hostGraph(roomId, [
        member(tableId, 'In'), nodeFromId(actorId), nodeFromId(otherId),
        binding('Base', [], [[tableId, 'table-in-room'], [actorId, 'actor-in-room'], [otherId, 'other-in-room']]),
    ], {
        edges: [
            { tag: 'Relational', from: tableId, to: tetherPort, ...tiedTo },
            { tag: 'Relational', from: tableId, to: leashPort, ...tiedTo },
        ],
    }),
    hostGraph(actorId, [
        member(bagId, 'Held'), member(ropeId, 'Held'),
        binding('actor-in-room', [[roomId, 'Base']], [[bagId, 'bag-held'], [ropeId, 'rope-held']]),
    ], {
        edges: [
            { tag: 'Relational', from: ropeId, to: heldPort, ...tiedTo },
            { tag: 'Relational', from: tetherPort, to: bagId, ...tiedTo },
        ],
        ports: [{ portId: tetherPort.port, fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'tied to' }],
    }),
    hostGraph(otherId, [
        member(leashId, 'Held'),
        binding('other-in-room', [[roomId, 'Base']], [[leashId, 'leash-held']]),
    ], {
        edges: [{ tag: 'Relational', from: leashPort, to: leashId, ...tiedTo }],
        ports: [{ portId: leashPort.port, fromHostId: roomId, kind: 'Custom', exteriorRelationLabel: 'tied to' }],
    }),
    hostGraph(leashId, [binding('leash-held', [[otherId, 'other-in-room']])]),
]).entries()]

const names: SceneFixture['names'] = {
    [roomId]: { shortName: 'Kitchen' },
    [tableId]: { shortName: 'Table', gloss: 'scrubbed pine, knife-scarred' },
    [lampId]: { shortName: 'Lamp', gloss: 'an oil lamp, unlit' },
    [ropeId]: { shortName: 'Rope', gloss: 'a coil of thick hemp rope' },
    [bagId]: { shortName: 'Bag', gloss: 'a drawstring leather pouch' },
    [coinId]: { shortName: 'Coin' },
}

export const heldInventoryScene: SceneFixture = {
    name: 'heldInventory',
    description: 'A held bag with a coin in it, and a rope half on the table and half in hand, tied across the bag to the coin.',
    roomId,
    actorId,
    graphs: kitchenGraphs(),
    names,
    questions: [
        { type: 'held' },
        { type: 'whereIs', subject: 'rope1' },
        { type: 'placedOn', subject: 'coin1' },
        { type: 'relatedTo', subject: 'rope1', label: 'tied to' },
        { type: 'relatedFrom', target: 'coin1', label: 'tied to' },
        { type: 'movesWith', subject: 'table1' },
    ],
}

export const openLegsScene: SceneFixture = {
    name: 'openLegs',
    description: 'The held-inventory Kitchen with the table tied to the bag (composed) and to another character\'s leash (an open leg).',
    roomId,
    actorId,
    graphs: kitchenCrossingGraphs(),
    names,
    questions: [
        { type: 'relatedTo', subject: 'table1', label: 'tied to' },
        { type: 'relatedFrom', target: 'bag1', label: 'tied to' },
        { type: 'movesWith', subject: 'table1' },
    ],
}
