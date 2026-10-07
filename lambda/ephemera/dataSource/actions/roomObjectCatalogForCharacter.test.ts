import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import type { EphemeraLudicGraph } from '../../dataSource/positions/ludicGraph'
import { testLudicGraph } from '../../dataSource/positions/ludicGraph/testFixtures'
import {
    getRoomObjectCatalogForCharacter,
    roomObjectLabelsFromCatalog,
} from './roomObjectCatalogForCharacter'

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

const catalogPerspectiveDeps = {
    getCharacterAssets: async () => ['ASSET#Test'],
    resolvePerspective: async () => ({ assetStack: ['ASSET#Test'] }),
    getComponentAggregate: async () => [],
}

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

describe('getRoomObjectCatalogForCharacter', () => {
    it('returns empty catalog when character has no room', async () => {
        const result = await getRoomObjectCatalogForCharacter(characterId, {
            getMembershipContainers: async () => [],
            getLudicGraph: async () => testLudicGraph(roomId),
        })

        expect(result).toEqual({ roomId: null, entries: [] })
    })

    it('returns catalog entries resolved from the merged aggregate', async () => {
        const result = await getRoomObjectCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
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

        expect(result.roomId).toBe(roomId)
        expect(result.entries).toEqual([
            { objectId: broomId, normalizedShortName: 'broom', presence: [roomId] },
            { objectId: anvilId, normalizedShortName: 'heavy anvil', presence: [roomId] },
        ])
        expect(roomObjectLabelsFromCatalog(result.entries)).toEqual(['broom', 'heavy anvil'])
    })

    it('resolves an authored merged ComponentAggregate shortName', async () => {
        const result = await getRoomObjectCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
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
            { objectId: authoredId, normalizedShortName: 'brass candlestick', presence: [roomId] },
        ])
    })

    it('skips objects without any shortName', async () => {
        const result = await getRoomObjectCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
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

        const result = await getRoomObjectCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getLudicGraph: getLudicGraphFromMap({
                [roomId]: testLudicGraph(roomId, {
                    nodes: [{ tag: 'Object', universalKey: tableId }],
                }),
                [tableId]: testLudicGraph(tableId, {
                    nodes: [
                        { tag: 'Object', universalKey: cupId },
                        { tag: 'Presence', universalKey: tableBinding, fromHostId: roomId, cover: { tag: 'Full' } },
                    ],
                }),
            }),
            getComponentAggregate: namedComponentAggregate({
                [tableId]: 'Table',
                [cupId]: 'Cup',
            }),
        })

        expect(result.entries).toEqual([
            { objectId: tableId, normalizedShortName: 'table', presence: [{ host: tableId, presence: tableBinding }] },
            { objectId: cupId, normalizedShortName: 'cup', presence: [{ host: tableId, presence: tableBinding }] },
        ])
    })
})
