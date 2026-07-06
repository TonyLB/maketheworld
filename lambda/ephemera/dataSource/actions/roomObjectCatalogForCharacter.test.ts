import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { testPositionGraph } from '../../dataSource/positions/positionGraph/testFixtures'
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

const catalogPerspectiveDeps = {
    getCharacterAssets: async () => ['ASSET#Test'],
    resolvePerspective: async () => ({ assetStack: ['ASSET#Test'] }),
    getComponentAggregate: async () => [],
}

describe('getRoomObjectCatalogForCharacter', () => {
    it('returns empty catalog when character has no room', async () => {
        const result = await getRoomObjectCatalogForCharacter(characterId, {
            getMembershipContainers: async () => [],
            getPositionGraph: async () => testPositionGraph(roomId),
            getImprovisationObject: async () => ({}),
        })

        expect(result).toEqual({ roomId: null, entries: [] })
    })

    it('returns catalog entries from improvisation fallback when aggregate has no shortName', async () => {
        const result = await getRoomObjectCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getPositionGraph: async () => testPositionGraph(roomId, {
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
            getPositionGraph: async () => testPositionGraph(roomId, {
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
            getPositionGraph: async () => testPositionGraph(roomId, {
                nodes: [{ tag: 'Object', universalKey: noNameId }],
            }),
            getImprovisationObject: async () => ({ component: new StandardObject({ tag: 'Object' }) }),
        })

        expect(result.entries).toEqual([])
    })
})
