import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingStepsForMove } from './presenceBindingStepsForMove'

const HOST_ID = 'OBJECT#Tray' as EphemeraObjectId
const FROM_ROOM = 'ROOM#Departure' as EphemeraRoomId
const OTHER_FROM = 'ROOM#Third' as EphemeraRoomId
const TO_ROOM = 'ROOM#Arrival' as EphemeraRoomId

describe('presenceBindingStepsForMove', () => {
    it('emits an add-only step for a pure add (empty froms)', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, [], TO_ROOM)

        expect(steps).toEqual([{
            kind: 'addPresenceBinding',
            hostId: HOST_ID,
            fromHostId: TO_ROOM,
            presenceUuid: expect.any(String),
        }])
    })

    it('emits remove-only steps for a pure remove (to: null) --- the missing-clear fix', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, [FROM_ROOM, OTHER_FROM], null)

        expect(steps).toEqual([
            { kind: 'removePresenceBinding', hostId: HOST_ID, fromHostId: FROM_ROOM },
            { kind: 'removePresenceBinding', hostId: HOST_ID, fromHostId: OTHER_FROM },
        ])
    })

    it('emits a remove-then-add pair for an ordinary rehost', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, [FROM_ROOM], TO_ROOM)

        expect(steps.map((step) => step.kind)).toEqual(['removePresenceBinding', 'addPresenceBinding'])
        expect(steps[0]).toEqual({ kind: 'removePresenceBinding', hostId: HOST_ID, fromHostId: FROM_ROOM })
        expect(steps[1]).toMatchObject({
            kind: 'addPresenceBinding',
            hostId: HOST_ID,
            fromHostId: TO_ROOM,
        })
    })

    it('emits nothing when there is neither a departure nor a destination', () => {
        expect(presenceBindingStepsForMove(HOST_ID, [], null)).toEqual([])
    })

    it('mints a fresh presenceUuid on every call', () => {
        const [first] = presenceBindingStepsForMove(HOST_ID, [], TO_ROOM)
        const [second] = presenceBindingStepsForMove(HOST_ID, [], TO_ROOM)

        expect((first as any).presenceUuid).not.toEqual((second as any).presenceUuid)
    })
})
