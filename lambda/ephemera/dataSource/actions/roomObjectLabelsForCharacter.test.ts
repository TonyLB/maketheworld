import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

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

describe('getRoomObjectLabelsForCharacter', () => {
    it('returns empty array when character has no room', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            getMembershipContainers: async () => [],
            getPositionGraph: async () => ({ nodes: [], edges: [] }),
            getImprovisationObject: async () => ({}),
        })

        expect(result).toEqual([])
    })

    it('returns normalized deduped labels for objects with improvisation shortNames', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getPositionGraph: async () => ({
                nodes: [
                    { tag: 'Object', universalKey: broomId },
                    { tag: 'Object', universalKey: anvilId },
                ],
                edges: [],
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

        expect(result).toEqual(['broom', 'heavy anvil'])
    })

    it('skips objects without a string shortName', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getPositionGraph: async () => ({
                nodes: [{ tag: 'Object', universalKey: noNameId }],
                edges: [],
            }),
            getImprovisationObject: async () => ({ component: new StandardObject({ tag: 'Object' }) }),
        })

        expect(result).toEqual([])
    })

    it('returns empty array when room graph has no objects', async () => {
        const result = await getRoomObjectLabelsForCharacter(characterId, {
            ...catalogPerspectiveDeps,
            getMembershipContainers: async () => [roomId],
            getPositionGraph: async () => ({ nodes: [], edges: [] }),
            getImprovisationObject: async () => ({}),
        })

        expect(result).toEqual([])
    })
})
