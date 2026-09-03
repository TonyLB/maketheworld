import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { testLudicGraph } from '../../dataSource/positions/ludicGraph/testFixtures'
import {
    collectNestedObjectIds,
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

const catalogPerspectiveDeps = {
    getCharacterAssets: async () => ['ASSET#Test'],
    resolvePerspective: async () => ({ assetStack: ['ASSET#Test'] }),
    getComponentAggregate: async () => [],
    getObjectLudicGraph: async (objectId: EphemeraObjectId) => testLudicGraph(objectId),
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
            getLudicGraph: async () => testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object', universalKey: broomId },
                    { tag: 'Object', universalKey: anvilId },
                ],
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
            getLudicGraph: async () => testLudicGraph(roomId, {
                nodes: [{ tag: 'Object', universalKey: authoredId }],
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
            getLudicGraph: async () => testLudicGraph(roomId, {
                nodes: [{ tag: 'Object', universalKey: noNameId }],
            }),
            getImprovisationObject: async () => ({ component: new StandardObject({ tag: 'Object' }) }),
        })

        expect(result.entries).toEqual([])
    })

    it('names an object nested inside a hosted object from the room (PV1-1)', async () => {
        const tableId = 'OBJECT#Table' as EphemeraObjectId
        const cupId = 'OBJECT#Cup' as EphemeraObjectId

        const result = await getRoomObjectCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getLudicGraph: async () => testLudicGraph(roomId, {
                nodes: [{ tag: 'Object', universalKey: tableId }],
            }),
            getObjectLudicGraph: async (objectId) => {
                if (objectId === tableId) {
                    return testLudicGraph(tableId, {
                        nodes: [{ tag: 'Object', universalKey: cupId }],
                    })
                }
                return testLudicGraph(objectId)
            },
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

describe('collectNestedObjectIds', () => {
    const objectId = (n: number) => `OBJECT#Nest${n}` as EphemeraObjectId

    it('stops expanding past the depth cap', async () => {
        // room -> obj1 -> obj2 -> ... -> obj7 (obj1..obj6 each host the next). Depth cap 5
        // expands obj1 through obj5 (discovering obj2..obj6) but never expands obj6 itself,
        // so obj7 --- only reachable by expanding obj6 --- is never discovered.
        const graphs = new Map<EphemeraObjectId, EphemeraObjectId[]>()
        for (let i = 1; i < 7; i++) {
            graphs.set(objectId(i), [objectId(i + 1)])
        }

        const result = await collectNestedObjectIds(
            [objectId(1)],
            async (id) => testLudicGraph(id, {
                nodes: (graphs.get(id) ?? []).map((hostedId) => ({ tag: 'Object' as const, universalKey: hostedId })),
            })
        )

        expect(result.has(objectId(6))).toBe(true)
        expect(result.has(objectId(7))).toBe(false)
    })

    it('terminates on a cyclic hosting fixture instead of looping forever', async () => {
        const a = objectId(101)
        const b = objectId(102)
        const graphs: Record<string, EphemeraObjectId[]> = {
            [a]: [b],
            [b]: [a],
        }

        const result = await collectNestedObjectIds(
            [a],
            async (id) => testLudicGraph(id, {
                nodes: (graphs[id] ?? []).map((hostedId) => ({ tag: 'Object' as const, universalKey: hostedId })),
            })
        )

        expect(result).toEqual(new Set([a, b]))
    })
})
