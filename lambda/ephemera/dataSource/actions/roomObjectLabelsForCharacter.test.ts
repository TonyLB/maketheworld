import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { mergedComponentResult } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { testLudicGraph } from '../positions/ludicGraph/testFixtures'
import { getRoomObjectLabelsForCharacter } from './roomObjectLabelsForCharacter'

const characterId = 'CHARACTER#Test' as EphemeraCharacterId
const roomId = 'ROOM#Kitchen' as EphemeraRoomId
const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
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

describe('getRoomObjectLabelsForCharacter', () => {
    it('returns empty array when character has no room', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            getMembershipContainers: async () => [],
            getLudicGraph: async () => testLudicGraph(roomId),
        })

        expect(result).toEqual([])
    })

    it('returns normalized deduped labels for objects resolved from the merged aggregate', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getLudicGraph: async () => testLudicGraph(roomId, {
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

        expect(result).toEqual(['broom', 'heavy anvil'])
    })

    it('skips objects without a string shortName', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getLudicGraph: async () => testLudicGraph(roomId, {
                nodes: [{ tag: 'Object', universalKey: noNameId }],
            }),
        })

        expect(result).toEqual([])
    })

    it('returns empty array when room graph has no objects', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getLudicGraph: async () => testLudicGraph(roomId),
        })

        expect(result).toEqual([])
    })
})
