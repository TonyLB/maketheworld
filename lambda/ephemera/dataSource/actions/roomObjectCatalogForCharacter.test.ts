import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
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

describe('getRoomObjectCatalogForCharacter', () => {
    it('returns empty catalog when character has no room', async () => {
        const result = await getRoomObjectCatalogForCharacter(characterId, {
            getMembershipContainers: async () => [],
            getLudicGraph: async () => testLudicGraph(roomId),
            getImprovisationObject: async () => ({}),
        })

        expect(result).toEqual({ roomId: null, entries: [] })
    })

    it('returns catalog entries from improvisation fallback when aggregate has no shortName', async () => {
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
            getImprovisationObject: async (objectId) => {
                if (objectId === broomId) {
                    return { component: makeObjectComponent('  Broom  ') }
                }
                if (objectId === anvilId) {
                    return { component: makeObjectComponent('Heavy   Anvil') }
                }
                return {}
            },
        })

        expect(result.roomId).toBe(roomId)
        expect(result.entries).toEqual([
            { objectId: broomId, normalizedShortName: 'broom' },
            { objectId: anvilId, normalizedShortName: 'heavy anvil' },
        ])
        expect(roomObjectLabelsFromCatalog(result.entries)).toEqual(['broom', 'heavy anvil'])
    })

    it('prefers merged ComponentAggregate shortName over improvisation', async () => {
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
            getImprovisationObject: async () => ({
                component: makeObjectComponent('wrong improvisation name'),
            }),
        })

        expect(result.entries).toEqual([
            { objectId: authoredId, normalizedShortName: 'brass candlestick' },
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
            getImprovisationObject: async () => ({ component: new StandardObject({ tag: 'Object' }) }),
        })

        expect(result.entries).toEqual([])
    })

    it('names an object nested inside a hosted object from the room', async () => {
        const tableId = 'OBJECT#Table' as EphemeraObjectId
        const cupId = 'OBJECT#Cup' as EphemeraObjectId

        const result = await getRoomObjectCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getLudicGraph: getLudicGraphFromMap({
                [roomId]: testLudicGraph(roomId, {
                    nodes: [{ tag: 'Object', universalKey: tableId }],
                }),
                [tableId]: testLudicGraph(tableId, {
                    nodes: [{ tag: 'Object', universalKey: cupId }],
                }),
            }),
            getImprovisationObject: async (objectId) => {
                if (objectId === tableId) {
                    return { component: makeObjectComponent('Table') }
                }
                if (objectId === cupId) {
                    return { component: makeObjectComponent('Cup') }
                }
                return {}
            },
        })

        expect(result.entries).toEqual([
            { objectId: tableId, normalizedShortName: 'table' },
            { objectId: cupId, normalizedShortName: 'cup' },
        ])
    })
})
