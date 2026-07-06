import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { planObjectClearFromAllHosts } from './planObjectClearFromAllHosts'

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('planObjectClearFromAllHosts', () => {
    it('returns no-op when object has no prior containers', () => {
        const plan = planObjectClearFromAllHosts({
            objectId: OBJECT_ID,
            priorContainers: [],
        })

        expect(plan.projection).toEqual({
            froms: [],
            to: null,
            changed: false,
        })
        expect(plan.hostEffects).toEqual([])
    })

    it('removes from sole room host', () => {
        const plan = planObjectClearFromAllHosts({
            objectId: OBJECT_ID,
            priorContainers: [ROOM_A],
        })

        expect(plan.projection).toEqual({
            froms: [ROOM_A],
            to: null,
            changed: true,
        })
        expect(plan.hostEffects).toEqual([
            { hostId: ROOM_A, identityId: OBJECT_ID, op: 'remove' },
        ])
    })

    it('removes from sole character inventory host', () => {
        const plan = planObjectClearFromAllHosts({
            objectId: OBJECT_ID,
            priorContainers: [CHARACTER_A],
        })

        expect(plan.projection).toEqual({
            froms: [CHARACTER_A],
            to: null,
            changed: true,
        })
        expect(plan.hostEffects).toEqual([
            { hostId: CHARACTER_A, identityId: OBJECT_ID, op: 'remove' },
        ])
    })

    it('removes from both room and character when multi-host drift', () => {
        const plan = planObjectClearFromAllHosts({
            objectId: OBJECT_ID,
            priorContainers: [ROOM_A, CHARACTER_A],
        })

        expect(plan.projection.changed).toBe(true)
        expect(plan.projection.froms).toEqual([ROOM_A, CHARACTER_A])
        expect(plan.hostEffects).toEqual([
            { hostId: ROOM_A, identityId: OBJECT_ID, op: 'remove' },
            { hostId: CHARACTER_A, identityId: OBJECT_ID, op: 'remove' },
        ])
    })
})
