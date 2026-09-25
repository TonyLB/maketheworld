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

describe('getHeldInventoryCatalogForCharacter', () => {
    it('returns empty catalog when character inventory graph has no objects', async () => {
        const result = await getHeldInventoryCatalogForCharacter(characterId, {
            getLudicGraph: async () => testLudicGraph(characterId),
        })

        expect(result).toEqual({ entries: [] })
    })

    it('returns catalog entries resolved from the merged aggregate', async () => {
        const result = await getHeldInventoryCatalogForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getLudicGraph: async () => testLudicGraph(characterId, {
                nodes: [
                    { tag: 'Object', universalKey: broomId },
                    { tag: 'Object', universalKey: anvilId },
                ],
            }),
            getComponentAggregate: namedComponentAggregate({
                [broomId]: '  Broom  ',
                [anvilId]: 'Heavy   Anvil',
            }),
        })

        expect(result.entries).toEqual([
            { objectId: broomId, normalizedShortName: 'broom' },
            { objectId: anvilId, normalizedShortName: 'heavy anvil' },
        ])
    })

    it('resolves an authored merged ComponentAggregate shortName', async () => {
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
        })

        expect(result.entries).toEqual([])
    })
})
