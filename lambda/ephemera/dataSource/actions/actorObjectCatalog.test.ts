import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import type { EphemeraLudicGraph } from '../../dataSource/positions/ludicGraph'
import { testLudicGraph } from '../../dataSource/positions/ludicGraph/testFixtures'
import { catalogDepsFromColdBuild } from './objectCatalogTestSupport'
import { getActorObjectCatalog } from './actorObjectCatalog'
import { actorCacheGraphs, actorId, bagId, coinId, graphReader, ropeId, roomId as kitchenId, tableId as fixtureTableId } from '../positions/ludicCache/actorCacheTestFixtures'
import { parentRemainderKey } from '../positions/ludicGraph/testFixtures'

const characterId = 'CHARACTER#Test' as EphemeraCharacterId
const roomId = 'ROOM#Kitchen' as EphemeraRoomId
const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const authoredId = 'OBJECT#Authored' as EphemeraObjectId
const noNameId = 'OBJECT#NoName' as EphemeraObjectId

const makeObjectComponent = (shortName: string) => new StandardObject({
    tag: 'Object',
    shortName,
})

/** Dispatches `getLudicGraph` by host id --- every host `buildLudicCache` walks, not just the room. */
const getLudicGraphFromMap = (graphs: Record<string, EphemeraLudicGraph>) => async (hostId: EphemeraMembershipHostId) =>
    graphs[hostId] ?? testLudicGraph(hostId as EphemeraObjectId)

const catalogPerspectiveDeps = {}
/** The catalog of a character standing in `room` (null: in no room), over a cold build of the fixture graphs. */
type CatalogFixture = Parameters<typeof catalogDepsFromColdBuild>[0] & { room?: EphemeraRoomId | null }
const getActorCatalog = async (characterId: EphemeraCharacterId, { room = roomId, ...deps }: CatalogFixture) => ({
    entries: await getActorObjectCatalog(characterId, { ...catalogDepsFromColdBuild(deps), getMembershipContainers: async () => (room ? [room] : []) }),
})

/** Resolves each host's shortName from `names` via a mocked merged aggregate, matching the real
 * per-host `getComponentAggregate([perspective])` call shape. */
const namedComponentAggregate = (names: Record<string, string>) =>
    async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => {
        const name = names[perspective.universalKey]
        return name
            ? [mergedComponentResult({
                universalKey: perspective.universalKey as EphemeraObjectId,
                merged: makeObjectComponent(name),
                mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
            })]
            : []
    }

describe('getActorObjectCatalog', () => {
    it('returns empty catalog when character has no room', async () => {
        const result = await getActorCatalog(characterId, {
            room: null,
            getLudicGraph: async () => testLudicGraph(roomId),
        })

        expect(result).toEqual({ entries: [] })
    })

    it('returns catalog entries resolved from the merged aggregate', async () => {
        const result = await getActorCatalog(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: getLudicGraphFromMap({
                [roomId]: testLudicGraph(roomId, {
                    nodes: [
                        { tag: 'Object', universalKey: broomId },
                        { tag: 'Object', universalKey: anvilId },
                    ],
                }),
            }),
            getComponentAggregate: namedComponentAggregate({
                [broomId]: '  Broom  ',
                [anvilId]: 'Heavy   Anvil',
            }),
        })

        expect(result.entries).toEqual([
            { objectId: broomId, normalizedShortName: 'broom', placement: [{ host: roomId, bindings: [] }], presence: [roomId], catalogScope: 'room' },
            { objectId: anvilId, normalizedShortName: 'heavy anvil', placement: [{ host: roomId, bindings: [] }], presence: [roomId], catalogScope: 'room' },
        ])
    })

    it('resolves an authored merged ComponentAggregate shortName', async () => {
        const result = await getActorCatalog(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: getLudicGraphFromMap({
                [roomId]: testLudicGraph(roomId, {
                    nodes: [{ tag: 'Object', universalKey: authoredId }],
                }),
            }),
            getComponentAggregate: async () => ([
                mergedComponentResult({
                    universalKey: authoredId,
                    merged: makeObjectComponent('Brass Candlestick'),
                    mergeParticipationOrderApplied: ['ASSET#Test'],
                }),
            ]),
        })

        expect(result.entries).toEqual([
            { objectId: authoredId, normalizedShortName: 'brass candlestick', placement: [{ host: roomId, bindings: [] }], presence: [roomId], catalogScope: 'room' },
        ])
    })

    it('skips objects without any shortName', async () => {
        const result = await getActorCatalog(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: getLudicGraphFromMap({
                [roomId]: testLudicGraph(roomId, {
                    nodes: [{ tag: 'Object', universalKey: noNameId }],
                }),
            }),
        })

        expect(result.entries).toEqual([])
    })

    it('names an object nested inside a hosted object from the room, and the bucket each was seen in', async () => {
        const tableId = 'OBJECT#Table' as EphemeraObjectId
        const cupId = 'OBJECT#Cup' as EphemeraObjectId
        const tableBinding = PresenceKey('table-in-kitchen')

        const result = await getActorCatalog(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: getLudicGraphFromMap({
                [roomId]: testLudicGraph(roomId, {
                    nodes: [{ tag: 'Object', universalKey: tableId }],
                }),
                [tableId]: testLudicGraph(tableId, {
                    nodes: [
                        { tag: 'Object', universalKey: cupId },
                        { tag: 'Presence', universalKey: tableBinding, fromHostPresences: [{ host: roomId, presence: parentRemainderKey(roomId) }], cover: { members: [] } },
                    ],
                }),
            }),
            getComponentAggregate: namedComponentAggregate({
                [tableId]: 'Table',
                [cupId]: 'Cup',
            }),
        })

        expect(result.entries).toEqual([
            {
                objectId: tableId,
                normalizedShortName: 'table',
                placement: [{ host: tableId, bindings: [{ presence: tableBinding, under: [{ host: roomId, presence: parentRemainderKey(roomId) }], rooms: [roomId] }] }],
                presence: [{ host: tableId, presence: tableBinding }],
                catalogScope: 'room',
            },
            { objectId: cupId, normalizedShortName: 'cup', placement: [{ host: tableId, bindings: [{ presence: tableBinding }] }], presence: [{ host: tableId, presence: tableBinding }], catalogScope: 'room' },
        ])
    })

    describe('with something in hand (the actor\'s cache)', () => {
        const named = (names: Record<string, string> = {}) => async ([perspective]: { universalKey: string, mergeParticipationOrder: readonly `ASSET#${string}`[] }[]) => [mergedComponentResult({
            universalKey: perspective.universalKey as EphemeraObjectId,
            merged: makeObjectComponent(names[perspective.universalKey] ?? perspective.universalKey.replace('OBJECT#', '').toLowerCase()),
            mergeParticipationOrderApplied: perspective.mergeParticipationOrder,
        })]
        const heldCatalog = async () => (await getActorCatalog(actorId, {
            room: kitchenId,
            getLudicGraph: graphReader(actorCacheGraphs()),
            getComponentAggregate: named() as any,
        })).entries
        const scopeOf = (entries: Awaited<ReturnType<typeof heldCatalog>>, objectId: EphemeraObjectId) => entries.find((entry) => entry.objectId === objectId)?.catalogScope

        it('lists what is nested inside a held container, scoped held', async () => {
            const entries = await heldCatalog()

            expect(entries.map(({ objectId }) => objectId)).toEqual(expect.arrayContaining([fixtureTableId, bagId, coinId, ropeId]))
            expect(scopeOf(entries, bagId)).toBe('held')
            expect(scopeOf(entries, coinId)).toBe('held')
        })

        it('scopes a half-held object and a room object as room', async () => {
            const entries = await heldCatalog()

            expect(scopeOf(entries, ropeId)).toBe('room')
            expect(scopeOf(entries, fixtureTableId)).toBe('room')
        })
    })
})
