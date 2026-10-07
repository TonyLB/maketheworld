import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { resolveNarrationLabels } from './resolveNarrationLabels'

const ACTOR = 'CHARACTER#Tess' as EphemeraCharacterId
const COMPANION = 'CHARACTER#Companion' as EphemeraCharacterId
const ROPE = 'OBJECT#Rope' as EphemeraObjectId
const UNNAMED = 'OBJECT#Unnamed' as EphemeraObjectId
const ROOM = 'ROOM#Bridge' as EphemeraRoomId

const deps = {
    getCharacterMeta: async (id: EphemeraCharacterId) => (id === ACTOR ? { Name: 'Tess' } : id === COMPANION ? { Name: 'Pat' } : undefined),
    getCharacterAssets: async () => [],
    resolvePerspective: async () => null,
    getComponentAggregate: jest.fn(),
    getImprovisationObject: async (id: EphemeraObjectId) => (
        id === ROPE ? { component: new StandardObject({ tag: 'Object', universalKey: ROPE, shortName: 'rope' }) } : {}
    ),
}

describe('resolveNarrationLabels', () => {
    it('names the actor, each object by its short name, and each character by its name, once per id', async () => {
        const labels = await resolveNarrationLabels({ characterId: ACTOR, ids: [ROPE, COMPANION, ROPE], roomId: ROOM }, deps)

        expect(labels).toEqual({ characterName: 'Tess', names: { [ROPE]: 'rope', [COMPANION]: 'Pat' } })
    })

    it('falls back to "something" for an unnamed object and "Someone" for an unnamed character', async () => {
        const labels = await resolveNarrationLabels(
            { characterId: 'CHARACTER#Ghost' as EphemeraCharacterId, ids: [UNNAMED, 'CHARACTER#Ghost' as EphemeraCharacterId], roomId: undefined },
            deps
        )

        expect(labels).toEqual({ characterName: 'Someone', names: { [UNNAMED]: 'something', 'CHARACTER#Ghost': 'Someone' } })
    })

    it('resolves no perspective when the actor is in no room, naming objects from the improvisation row alone', async () => {
        const resolvePerspective = jest.fn()

        await resolveNarrationLabels({ characterId: ACTOR, ids: [ROPE], roomId: undefined }, { ...deps, resolvePerspective })

        expect(resolvePerspective).not.toHaveBeenCalled()
    })
})
