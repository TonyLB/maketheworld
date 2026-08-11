import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { testLudicGraph } from '../positions/ludicGraph/testFixtures'
import { getHeldInventoryCatalogForCharacter } from './heldInventoryCatalogForCharacter'

const characterId = 'CHARACTER#Test' as EphemeraCharacterId
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
    getComponentAggregate: async () => [],
}

describe('getHeldInventoryCatalogForCharacter', () => {
    it('returns empty catalog when character inventory graph has no objects', async () => {
        const result = await getHeldInventoryCatalogForCharacter(characterId, {
            getLudicGraph: async () => testLudicGraph(characterId),
            getImprovisationObject: async () => ({}),
        })

        expect(result).toEqual({ entries: [] })
    })

    it('returns catalog entries from improvisation fallback when aggregate has no shortName', async () => {
        const result = await getHeldInventoryCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: async () => testLudicGraph(characterId, {
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

        expect(result.entries).toEqual([
            { objectId: broomId, normalizedShortName: 'broom' },
            { objectId: anvilId, normalizedShortName: 'heavy anvil' },
        ])
    })

    it('prefers merged ComponentAggregate shortName over improvisation', async () => {
        const result = await getHeldInventoryCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: async () => testLudicGraph(characterId, {
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
        const result = await getHeldInventoryCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: async () => testLudicGraph(characterId, {
                nodes: [{ tag: 'Object', universalKey: noNameId }],
            }),
            getImprovisationObject: async () => ({ component: new StandardObject({ tag: 'Object' }) }),
        })

        expect(result.entries).toEqual([])
    })
})
