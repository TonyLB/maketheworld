import type { EphemeraAreaId, EphemeraConceptId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { EphemeraLudicGraph } from '../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../ludicGraph/testFixtures'
import { conceptNamesFromCache, handlesFromCache } from './catalogHandles'
import { buildLudicCache, type BuildLudicCacheDeps } from './fold'
import { roomsForReferent } from '../ludicGraph/presenceRooms'
import { audienceBuckets, defaultReading, readingsOf } from '../../actions/objectViews'
import { parentRemainderKey } from '../ludicGraph/testFixtures'

const makeObjectComponent = (shortName: string) => new StandardObject({ tag: 'Object', shortName })

const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const pebble = 'OBJECT#Pebble' as EphemeraObjectId
const namedId = 'OBJECT#Named' as EphemeraObjectId

const noShortNameDeps = () => ({
    getComponentAggregate: jest.fn(async () => []),
})

/** Resolves each host's shortName from `names` via a mocked merged aggregate, matching the real
 * per-host `getComponentAggregate([perspective])` call shape. */
const namedShortNameDeps = (names: Record<string, string>) => ({
    getComponentAggregate: jest.fn(async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => {
        const name = names[perspective.universalKey]
        return name
            ? [mergedComponentResult({
                universalKey: perspective.universalKey as EphemeraObjectId,
                merged: makeObjectComponent(name),
                mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
            })]
            : []
    }),
})

const graphsAsDeps = (graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>) => ({
    getLudicGraph: async (hostId: EphemeraMembershipHostId) => {
        const graph = graphs.get(hostId)
        if (!graph) {
            throw new Error(`No fixture graph for ${hostId}`)
        }
        return graph
    },
})

/** A seed's handles over a cold fold of the fixture graphs. */
const coldHandles = async (seedHostId: EphemeraMembershipHostId, deps: BuildLudicCacheDeps) => (
    handlesFromCache((await buildLudicCache(seedHostId, [], deps)).cache, seedHostId)
)

describe('handlesFromCache', () => {
    it('returns a flat handle per object node, never the raw cache shape', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: namedId }],
        })
        const namedGraph = testLudicGraph(namedId, { nodes: [{ tag: 'Object', universalKey: namedId }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [namedId, namedGraph],
        ])

        const handles = await coldHandles(roomA, {
            ...graphsAsDeps(graphs),
            ...namedShortNameDeps({ [namedId]: 'Named Thing' }),
        })

        expect(handles).toEqual([{ objectId: namedId, shortName: 'Named Thing', placement: [{ host: roomA, bindings: [] }], presence: [roomA] }])
    })

    it('excludes an object whose shortName never resolved', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: namedId }],
        })
        const namedGraph = testLudicGraph(namedId, { nodes: [{ tag: 'Object', universalKey: namedId }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [namedId, namedGraph],
        ])

        const handles = await coldHandles(roomA, { ...graphsAsDeps(graphs), ...noShortNameDeps() })

        expect(handles).toEqual([])
    })

    // Terminal semantics: an unresolved crossing port (one side of a parent/child boundary
    // missing its matching leg) leaves cache.edges empty for that pair, mirroring
    // fold.test.ts's "does not invent an edge" regression --- but it must never suppress the
    // object NODE handle itself. A `not consolidated here` edge is not `nothing exists`.
    it('still returns every object handle when a crossing port is left unresolved', async () => {
        const roomGraph = testLudicGraph(roomA, {
            nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: boxId }],
        })
        const boxGraph = testLudicGraph(boxId, {
            nodes: [{ tag: 'Object', universalKey: boxId }, { tag: 'Object', universalKey: pebble }],
            edges: [{ tag: 'Relational', from: { owner: boxId, port: 'PORT-port_1' }, to: pebble, kind: 'ConnectedTo' }],
            ports: [{ portId: 'PORT-port_1', fromHostId: boxId, kind: 'ConnectedTo' }],
        })
        const pebbleGraph = testLudicGraph(pebble, { nodes: [{ tag: 'Object', universalKey: pebble }] })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, roomGraph], [boxId, boxGraph], [pebble, pebbleGraph],
        ])

        const handles = await coldHandles(roomA, {
            ...graphsAsDeps(graphs),
            ...namedShortNameDeps({ [boxId]: 'Box', [pebble]: 'Pebble' }),
        })

        expect(handles.map(({ objectId }) => objectId).sort()).toEqual([boxId, pebble].sort())
    })

    // Every whole's root binding is `PRESENCE#Base`, so a box in a room meets
    // two bindings with one bare id. Buckets are told apart by owner.
    it('keeps the room\'s Base and the box\'s own Base as two buckets for the box', async () => {
        const base = 'PRESENCE#Base' as const
        const roomGraph = testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Object', universalKey: boxId },
                { tag: 'Presence', universalKey: base, fromHostPresences: [], cover: { members: [{ host: boxId, presence: base }] } },
            ],
        })
        const boxGraph = testLudicGraph(boxId, {
            nodes: [
                { tag: 'Object', universalKey: boxId },
                { tag: 'Object', universalKey: pebble },
                { tag: 'Presence', universalKey: base, fromHostPresences: [{ host: roomA, presence: base }], cover: { members: [{ host: pebble, presence: base }] } },
            ],
        })
        const pebbleGraph = testLudicGraph(pebble, {
            nodes: [{ tag: 'Object', universalKey: pebble }, { tag: 'Presence', universalKey: base, fromHostPresences: [{ host: boxId, presence: base }], cover: { members: [] } }],
        })
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[roomA, roomGraph], [boxId, boxGraph], [pebble, pebbleGraph]])

        const handles = await coldHandles(roomA, {
            ...graphsAsDeps(graphs),
            ...namedShortNameDeps({ [boxId]: 'Box', [pebble]: 'Pebble' }),
        })

        const box = handles.find(({ objectId }) => objectId === boxId)
        expect(box?.presence?.map((bucket) => (bucket as any).host ?? bucket)).toEqual(expect.arrayContaining([roomA, boxId]))
        expect(box?.presence).toHaveLength(2)
    })

    // Each handle names the bucket the walk saw it in, so Grounding can stamp it.
    describe('presence', () => {
        const boxBinding = PresenceKey('box-in-a')
        const boxOtherBinding = PresenceKey('box-in-b')
        const stone = 'OBJECT#Stone' as EphemeraObjectId
        type Binding = { key: typeof boxBinding, from: EphemeraMembershipHostId, cover?: EphemeraPresenceCover }
        const boxInRoom = (bindings: Binding[]) => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, {
                nodes: [
                    { tag: 'Room', universalKey: roomA },
                    { tag: 'Object', universalKey: boxId },
                    ...(bindings.some(({ from }) => from === roomA)
                        ? [{ tag: 'Presence' as const, universalKey: parentRemainderKey(roomA), fromHostPresences: [], cover: { members: bindings.filter(({ from }) => from === roomA).map(({ key }) => ({ host: boxId, presence: key })) } }]
                        : []),
                ],
            })],
            [boxId, testLudicGraph(boxId, {
                nodes: [
                    { tag: 'Object', universalKey: boxId },
                    { tag: 'Object', universalKey: pebble },
                    { tag: 'Object', universalKey: stone },
                    ...bindings.map(({ key, from, cover }) => ({ tag: 'Presence' as const, universalKey: key, fromHostPresences: [{ host: from, presence: parentRemainderKey(from) }], cover: cover ?? { members: [pebble, stone].map((host) => ({ host, presence: PresenceKey(`${host.slice(7).toLowerCase()}-in-box`) })) } })),
                ],
            })],
            [pebble, testLudicGraph(pebble, { nodes: [{ tag: 'Object', universalKey: pebble }] })],
            [stone, testLudicGraph(stone, { nodes: [{ tag: 'Object', universalKey: stone }] })],
        ])
        const names = namedShortNameDeps({ [boxId]: 'Box', [pebble]: 'Pebble', [stone]: 'Stone' })
        // A bucket names the host that owns it: the box's binding lives on the box's graph, even when the pebble is the one seen through it.
        const ofBox = (presence: typeof boxBinding) => ({ host: boxId, presence })
        // The room's own root binding lists the box, so the box is seen there too.
        const inRoomA = { host: roomA, presence: parentRemainderKey(roomA) }
        const presenceOf = (handles: { objectId: string, presence?: unknown }[], objectId: string) =>
            handles.find((handle) => handle.objectId === objectId)?.presence

        // A host is the root of its own graph, so it is in each of its own buckets even though
        // `cover` leaves the root out: the box's handle names its own binding, not the room.
        it('names the box\'s own binding for the box, and that binding for a thing inside it', async () => {
            const handles = await coldHandles(roomA, {
                ...graphsAsDeps(boxInRoom([{ key: boxBinding, from: roomA }])),
                ...names,
            })

            expect(handles).toEqual(expect.arrayContaining([
                {
                    objectId: boxId,
                    shortName: 'Box',
                    // The box's own binding records the parent it sits under and the room that parent reaches.
                    placement: [
                        { host: roomA, bindings: [{ presence: inRoomA.presence }] },
                        { host: boxId, bindings: [{ presence: boxBinding, under: [inRoomA], rooms: [roomA] }] },
                    ],
                    presence: [inRoomA, ofBox(boxBinding)],
                },
                { objectId: pebble, shortName: 'Pebble', placement: [{ host: boxId, bindings: [{ presence: boxBinding }] }], presence: [ofBox(boxBinding)] },
            ]))
        })

        // The payoff: a whole bound into several rooms ("kick the table") is seen in every one.
        it('names every one of a whole\'s own bindings, including one into a room the walk never reached', async () => {
            const handles = await coldHandles(roomA, {
                ...graphsAsDeps(boxInRoom([{ key: boxOtherBinding, from: roomB }, { key: boxBinding, from: roomA }])),
                ...names,
            })

            expect(presenceOf(handles, boxId)).toEqual([inRoomA, ofBox(boxOtherBinding), ofBox(boxBinding)])
        })

        it('names both the covering bucket and a contained thing\'s own binding, once each', async () => {
            const pebbleInBox = PresenceKey('pebble-in-box')
            const graphs = boxInRoom([{
                key: boxBinding,
                from: roomA,
                cover: { members: [{ host: pebble, presence: pebbleInBox }] },
            }])
            graphs.set(pebble, testLudicGraph(pebble, {
                nodes: [
                    { tag: 'Object', universalKey: pebble },
                    { tag: 'Presence', universalKey: pebbleInBox, fromHostPresences: [{ host: boxId, presence: parentRemainderKey(boxId) }], cover: { members: [] } },
                ],
            }))

            const handles = await coldHandles(roomA, { ...graphsAsDeps(graphs), ...names })

            expect(presenceOf(handles, pebble)).toEqual(expect.arrayContaining([ofBox(boxBinding), { host: pebble, presence: pebbleInBox }]))
            expect(presenceOf(handles, pebble)).toHaveLength(2)
        })

        // Perspective picks which thing a phrase means, not who can see it change: a box bound into
        // two rooms with `Full` covers shows the pebble in both, walked or not.
        it('lists every bucket that holds it, including one bound into a room the walk never reached', async () => {
            const handles = await coldHandles(roomA, {
                ...graphsAsDeps(boxInRoom([{ key: boxOtherBinding, from: roomB }, { key: boxBinding, from: roomA }])),
                ...names,
            })

            expect(presenceOf(handles, pebble)).toEqual([ofBox(boxOtherBinding), ofBox(boxBinding)])
        })

        // A straddling whole partitions its contents: each half's things are in that half's bucket only.
        it('names only the bucket whose Enumerated cover holds it', async () => {
            const handles = await coldHandles(roomA, {
                ...graphsAsDeps(boxInRoom([
                    { key: boxBinding, from: roomA, cover: { members: [{ host: pebble, presence: PresenceKey('pebble-in-box') }] } },
                    { key: boxOtherBinding, from: roomB, cover: { members: [{ host: stone, presence: PresenceKey('stone-in-box') }] } },
                ])),
                ...names,
            })

            expect(presenceOf(handles, pebble)).toEqual([ofBox(boxBinding)])
            expect(presenceOf(handles, stone)).toEqual([ofBox(boxOtherBinding)])
        })

        it('falls back to the seed room when the containing host has no binding', async () => {
            const handles = await coldHandles(roomA, { ...graphsAsDeps(boxInRoom([])), ...names })

            expect(presenceOf(handles, pebble)).toEqual([roomA])
        })
    })

    // The room rule (PR-21(f)): a room's Area binding is a carve-out with no members, so a thing
    // sitting in the room is seen in the room itself, not in a bucket that resolves to no rooms.
    describe('room bound into an Area', () => {
        const town = 'AREA#Town' as EphemeraAreaId
        const roomInTown = PresenceKey('a-in-town')

        // The stored shape (PR-21(f)): the room keeps one hostless remainder and an empty Area carve-out;
        // a thing in the room points at the remainder.
        it('resolves to the room when the room holds a hostless remainder beside its empty Area carve-out', async () => {
            const roomRemainder = PresenceKey('a-remainder')
            const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
                [roomA, testLudicGraph(roomA, {
                    nodes: [
                        { tag: 'Room', universalKey: roomA },
                        { tag: 'Object', universalKey: namedId },
                        { tag: 'Presence', universalKey: roomRemainder, fromHostPresences: [], cover: { members: [] } },
                        { tag: 'Presence', universalKey: roomInTown, fromHostPresences: [{ host: town, presence: parentRemainderKey(town) }], cover: { members: [] } },
                    ],
                })],
                [namedId, testLudicGraph(namedId, {
                    nodes: [
                        { tag: 'Object', universalKey: namedId },
                        { tag: 'Presence', universalKey: PresenceKey('named-in-a'), fromHostPresences: [{ host: roomA, presence: roomRemainder }], cover: { members: [] } },
                    ],
                })],
            ])
            const getGraph = async (hostId: EphemeraMembershipHostId) => graphs.get(hostId) ?? testLudicGraph(hostId, { nodes: [] })

            const handles = await coldHandles(roomA, {
                ...graphsAsDeps(graphs),
                ...namedShortNameDeps({ [namedId]: 'Named Thing' }),
            })

            expect(handles).toHaveLength(1)
            await expect(roomsForReferent(namedId, handles[0].presence as never, getGraph)).resolves.toEqual(new Set([roomA]))
        })

        // The Slice 2 residual: seeded at the Area, a walked room's members now have a bucket,
        // because each member's stored pointer names the room.
        it('resolves an Area-seeded handle for a thing in a walked room to that room', async () => {
            const roomRemainder = PresenceKey('a-remainder')
            const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
                [town, testLudicGraph(town, { nodes: [{ tag: 'Room', universalKey: roomA }] })],
                [roomA, testLudicGraph(roomA, {
                    nodes: [
                        { tag: 'Room', universalKey: roomA },
                        { tag: 'Object', universalKey: namedId },
                        { tag: 'Presence', universalKey: roomRemainder, fromHostPresences: [], cover: { members: [] } },
                        { tag: 'Presence', universalKey: roomInTown, fromHostPresences: [{ host: town, presence: parentRemainderKey(town) }], cover: { members: [] } },
                    ],
                })],
                [namedId, testLudicGraph(namedId, {
                    nodes: [
                        { tag: 'Object', universalKey: namedId },
                        { tag: 'Presence', universalKey: PresenceKey('named-in-a'), fromHostPresences: [{ host: roomA, presence: roomRemainder }], cover: { members: [] } },
                    ],
                })],
            ])
            const getGraph = async (hostId: EphemeraMembershipHostId) => graphs.get(hostId) ?? testLudicGraph(hostId, { nodes: [] })

            const handles = await coldHandles(town, {
                ...graphsAsDeps(graphs),
                ...namedShortNameDeps({ [namedId]: 'Named Thing' }),
            })

            expect(handles).toHaveLength(1)
            await expect(roomsForReferent(namedId, handles[0].presence as never, getGraph)).resolves.toEqual(new Set([roomA]))
        })
    })
})

describe('handlesFromCache over a stored row', () => {
    it('returns the same handles from a stored cache as a cold rebuild does', async () => {
        const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
            [roomA, testLudicGraph(roomA, { nodes: [{ tag: 'Room', universalKey: roomA }, { tag: 'Object', universalKey: namedId }] })],
            [namedId, testLudicGraph(namedId, { nodes: [{ tag: 'Object', universalKey: namedId }] })],
        ])
        const { cache } = await buildLudicCache(roomA, [], { ...graphsAsDeps(graphs), ...namedShortNameDeps({ [namedId]: 'Named Thing' }) })
        const stored = JSON.parse(JSON.stringify(cache))

        expect(handlesFromCache(stored, roomA)).toEqual([{ objectId: namedId, shortName: 'Named Thing', placement: [{ host: roomA, bindings: [] }], presence: [roomA] }])
    })
})

// The Slice 0 worlds of the position-referents plan, through the real cold fold: the catalog's presence is a
// flat set (F1), and `placement` is the structure it is projected from.
describe('placement', () => {
    const tableId = 'OBJECT#Table' as EphemeraObjectId
    const ropeId = 'OBJECT#Rope' as EphemeraObjectId
    const base = parentRemainderKey(roomA)
    const names = namedShortNameDeps({ [tableId]: 'Table', [ropeId]: 'Rope' })
    const rope = (handles: ReturnType<typeof handlesFromCache>) => handles.find(({ objectId }) => objectId === ropeId)!

    // A rope spread over a table: one binding under the room (on the floor), one under the table.
    const tableBinding = PresenceKey('table-in-a')
    const ropeOnFloor = PresenceKey('rope-on-floor')
    const ropeOnTable = PresenceKey('rope-on-table')
    const ropeOverTable = () => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
        [roomA, testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Object', universalKey: tableId },
                { tag: 'Object', universalKey: ropeId },
                { tag: 'Presence', universalKey: base, fromHostPresences: [], cover: { members: [{ host: tableId, presence: tableBinding }, { host: ropeId, presence: ropeOnFloor }] } },
            ],
        })],
        [tableId, testLudicGraph(tableId, {
            nodes: [
                { tag: 'Object', universalKey: tableId },
                { tag: 'Object', universalKey: ropeId },
                { tag: 'Presence', universalKey: tableBinding, fromHostPresences: [{ host: roomA, presence: base }], cover: { members: [{ host: ropeId, presence: ropeOnTable }] } },
            ],
        })],
        [ropeId, testLudicGraph(ropeId, {
            nodes: [
                { tag: 'Object', universalKey: ropeId },
                { tag: 'Presence', universalKey: ropeOnFloor, fromHostPresences: [{ host: roomA, presence: base }], cover: { members: [] } },
                { tag: 'Presence', universalKey: ropeOnTable, fromHostPresences: [{ host: tableId, presence: tableBinding }], cover: { members: [] } },
            ],
        })],
    ])

    it('pairs each of the rope\'s own bindings with the parent it sits under, one entry per owner', async () => {
        const handles = await coldHandles(roomA, { ...graphsAsDeps(ropeOverTable()), ...names })

        expect(rope(handles).placement).toEqual([
            { host: roomA, bindings: [{ presence: base }] },
            { host: tableId, bindings: [{ presence: tableBinding }] },
            {
                host: ropeId,
                bindings: [
                    { presence: ropeOnFloor, under: [{ host: roomA, presence: base }], rooms: [roomA] },
                    { presence: ropeOnTable, under: [{ host: tableId, presence: tableBinding }], rooms: [roomA] },
                ],
            },
        ])
    })

    it('projects the flat set the audience readers have always read', async () => {
        const handles = await coldHandles(roomA, { ...graphsAsDeps(ropeOverTable()), ...names })

        expect(rope(handles).presence).toEqual([
            { host: roomA, presence: base },
            { host: tableId, presence: tableBinding },
            { host: ropeId, presence: ropeOnFloor },
            { host: ropeId, presence: ropeOnTable },
        ])
        handles.forEach(({ placement, presence }) => expect(presence).toEqual(audienceBuckets(placement!)))
    })

    it('reads two readings, both in the actor\'s room, so no default (the command would ask)', async () => {
        const { placement } = rope(await coldHandles(roomA, { ...graphsAsDeps(ropeOverTable()), ...names }))

        expect(readingsOf(ropeId, placement!).map(({ bindings }) => bindings)).toEqual([[ropeOnFloor], [ropeOnTable]])
        expect(defaultReading(ropeId, placement!, roomA)).toBeUndefined()
    })

    // A rope across two rooms: one end in each, the actor in room B.
    const farEnd = PresenceKey('rope-far-end')
    const ropeAcrossRooms = () => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
        [roomB, testLudicGraph(roomB, {
            nodes: [
                { tag: 'Room', universalKey: roomB },
                { tag: 'Object', universalKey: ropeId },
                { tag: 'Presence', universalKey: base, fromHostPresences: [], cover: { members: [{ host: ropeId, presence: farEnd }] } },
            ],
        })],
        [ropeId, testLudicGraph(ropeId, {
            nodes: [
                { tag: 'Object', universalKey: ropeId },
                { tag: 'Presence', universalKey: ropeOnFloor, fromHostPresences: [{ host: roomA, presence: base }], cover: { members: [] } },
                { tag: 'Presence', universalKey: farEnd, fromHostPresences: [{ host: roomB, presence: base }], cover: { members: [] } },
            ],
        })],
    ])

    it('takes the end in the actor\'s room as the default, though both ends are in the set', async () => {
        const handles = await coldHandles(roomB, { ...graphsAsDeps(ropeAcrossRooms()), ...names })
        const { placement, presence } = rope(handles)

        expect(presence).toEqual([
            { host: roomB, presence: base },
            { host: ropeId, presence: ropeOnFloor },
            { host: ropeId, presence: farEnd },
        ])
        expect(defaultReading(ropeId, placement!, roomB)?.bindings).toEqual([farEnd])
        expect(defaultReading(ropeId, placement!, roomA)?.bindings).toEqual([ropeOnFloor])
    })

    it('has one reading, and so a default, for an object with one binding', async () => {
        const single = new Map(ropeOverTable()).set(ropeId, testLudicGraph(ropeId, {
            nodes: [{ tag: 'Object', universalKey: ropeId }, { tag: 'Presence', universalKey: ropeOnFloor, fromHostPresences: [{ host: roomA, presence: base }], cover: { members: [] } }],
        }))
        const { placement } = rope(await coldHandles(roomA, { ...graphsAsDeps(single), ...names }))

        expect(defaultReading(ropeId, placement!, roomA)?.bindings).toEqual([ropeOnFloor])
    })
})

describe('a Concept bound in a room (AK-7, AK-8)', () => {
    const systemId = 'CONCEPT#ControlSystem' as EphemeraConceptId
    const terminalId = 'OBJECT#Terminal' as EphemeraObjectId
    const farTerminalId = 'OBJECT#FarTerminal' as EphemeraObjectId

    const graphs = () => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
        [roomA, testLudicGraph(roomA, {
            nodes: [
                { tag: 'Room', universalKey: roomA },
                { tag: 'Concept', universalKey: systemId, hostingKind: 'Associated' },
                { tag: 'Object', universalKey: terminalId, hostingKind: 'In' },
                presenceBindingNode(parentRemainderKey(roomA), undefined, { members: [{ host: systemId, presence: 'PRESENCE#here' as any }, { host: terminalId, presence: 'PRESENCE#Base' as any }] }),
            ],
        })],
        [systemId, testLudicGraph(systemId, {
            nodes: [
                { tag: 'Concept', universalKey: systemId },
                { tag: 'Object', universalKey: terminalId, hostingKind: 'Associated' },
                { tag: 'Object', universalKey: farTerminalId, hostingKind: 'Associated' },
                presenceBindingNode('Base'),
                presenceBindingNode('here', roomA, { members: [{ host: terminalId, presence: 'PRESENCE#assoc' as any }] }),
                presenceBindingNode('there', roomB, { members: [{ host: farTerminalId, presence: 'PRESENCE#assoc' as any }] }),
            ],
        })],
        [terminalId, testLudicGraph(terminalId, { nodes: [{ tag: 'Object', universalKey: terminalId }, presenceBindingNode('Base', roomA), presenceBindingNode('assoc', { host: systemId, presence: 'PRESENCE#here' as any })] })],
        [farTerminalId, testLudicGraph(farTerminalId, { nodes: [{ tag: 'Object', universalKey: farTerminalId }, presenceBindingNode('assoc', { host: systemId, presence: 'PRESENCE#there' as any })] })],
    ])
    const names = { [systemId]: 'control system', [terminalId]: 'terminal', [farTerminalId]: 'far terminal' }

    it('reaches the cache as a named node; the catalog keeps the physically present terminal, and drops the Concept and a member bound only through it', async () => {
        const deps = { ...graphsAsDeps(graphs()), ...namedShortNameDeps(names) }

        const { cache } = await buildLudicCache(roomA, [], deps)

        expect(cache.nodes.find((node) => node.universalKey === systemId)?.shortName).toBe('control system')
        expect(handlesFromCache(cache, roomA).map((handle) => handle.objectId)).toEqual([terminalId])
    })

    it('offers its name to the name-only refusal (AK-8) and nothing else', async () => {
        const deps = { ...graphsAsDeps(graphs()), ...namedShortNameDeps(names) }

        const { cache } = await buildLudicCache(roomA, [], deps)

        expect(conceptNamesFromCache(cache)).toEqual(['control system'])
    })

    // AK-7 promises nothing about members bound only in another room: `enumerateLudicCacheShards` walks every
    // node of a shard, so `OBJECT#FarTerminal` (bound only under the system's binding in room B) also enters room
    // A's cache today. Over-delivery is accepted (user, 2026-11-01); there is no contract to omit it.
})
