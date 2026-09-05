import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presencePortStepsForMove } from './presencePortStepsForMove'

const HOST_ID = 'OBJECT#Tray' as EphemeraObjectId
const FROM_ROOM = 'ROOM#Departure' as EphemeraRoomId
const OTHER_FROM = 'ROOM#Third' as EphemeraRoomId
const TO_ROOM = 'ROOM#Arrival' as EphemeraRoomId

describe('presencePortStepsForMove', () => {
    it('emits an add-only step for a pure add (empty froms)', () => {
        const steps = presencePortStepsForMove(HOST_ID, [], TO_ROOM)

        expect(steps).toEqual([{
            kind: 'addPresencePort',
            hostId: HOST_ID,
            port: expect.objectContaining({ fromHostId: TO_ROOM, kind: 'Present' }),
        }])
    })

    it('emits remove-only steps for a pure remove (to: null) --- the missing-clear fix', () => {
        const steps = presencePortStepsForMove(HOST_ID, [FROM_ROOM, OTHER_FROM], null)

        expect(steps).toEqual([
            { kind: 'removePresencePort', hostId: HOST_ID, fromHostId: FROM_ROOM },
            { kind: 'removePresencePort', hostId: HOST_ID, fromHostId: OTHER_FROM },
        ])
    })

    it('emits a remove-then-add pair for an ordinary rehost', () => {
        const steps = presencePortStepsForMove(HOST_ID, [FROM_ROOM], TO_ROOM)

        expect(steps.map((step) => step.kind)).toEqual(['removePresencePort', 'addPresencePort'])
        expect(steps[0]).toEqual({ kind: 'removePresencePort', hostId: HOST_ID, fromHostId: FROM_ROOM })
        expect(steps[1]).toMatchObject({
            kind: 'addPresencePort',
            hostId: HOST_ID,
            port: { fromHostId: TO_ROOM, kind: 'Present' },
        })
    })

    it('emits nothing when there is neither a departure nor a destination', () => {
        expect(presencePortStepsForMove(HOST_ID, [], null)).toEqual([])
    })

    it('mints a fresh portId on every call', () => {
        const [first] = presencePortStepsForMove(HOST_ID, [], TO_ROOM)
        const [second] = presencePortStepsForMove(HOST_ID, [], TO_ROOM)

        expect((first as any).port.portId).not.toEqual((second as any).port.portId)
    })
})
