import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingStepsForMove } from './presenceBindingStepsForMove'

const HOST_ID = 'OBJECT#Tray' as EphemeraObjectId
const FROM_ROOM = 'ROOM#Departure' as EphemeraRoomId
const OTHER_FROM = 'ROOM#Third' as EphemeraRoomId
const TO_ROOM = 'ROOM#Arrival' as EphemeraRoomId

describe('presenceBindingStepsForMove', () => {
    it('emits one re-point step for a first placement (empty froms)', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, [], TO_ROOM)

        expect(steps).toEqual([{
            kind: 'rehostPresenceBinding',
            hostId: HOST_ID,
            fromHostIds: [],
            toHostId: TO_ROOM,
            presenceUuid: expect.any(String),
        }])
    })

    it('emits one re-point step for a departure to no host (to: null), which the kernel leaves hostless', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, [FROM_ROOM, OTHER_FROM], null)

        expect(steps).toEqual([{
            kind: 'rehostPresenceBinding',
            hostId: HOST_ID,
            fromHostIds: [FROM_ROOM, OTHER_FROM],
            toHostId: null,
            presenceUuid: expect.any(String),
        }])
    })

    it('emits one re-point step for an ordinary rehost, not a remove-then-add pair', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, [FROM_ROOM], TO_ROOM)

        expect(steps).toEqual([{
            kind: 'rehostPresenceBinding',
            hostId: HOST_ID,
            fromHostIds: [FROM_ROOM],
            toHostId: TO_ROOM,
            presenceUuid: expect.any(String),
        }])
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
