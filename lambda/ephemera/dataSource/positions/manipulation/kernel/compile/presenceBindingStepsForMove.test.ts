import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingStepsForMove } from './presenceBindingStepsForMove'

const HOST_ID = 'OBJECT#Tray' as EphemeraObjectId
const FROM_ROOM = 'ROOM#Departure' as EphemeraRoomId
const OTHER_FROM = 'ROOM#Third' as EphemeraRoomId
const TO_ROOM = 'ROOM#Arrival' as EphemeraRoomId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId
const TO = { host: TO_ROOM, presence: presence('arrival-remainder') }

describe('presenceBindingStepsForMove', () => {
    it('emits one move per named binding, carrying the producer\'s bindings verbatim', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
            froms: [FROM_ROOM],
            to: TO_ROOM,
            presenceMoves: [{ presence: presence('a'), from: { host: FROM_ROOM, presence: presence('from-remainder') }, to: TO }],
        })

        expect(steps).toEqual([{
            kind: 'movePresenceBinding',
            hostId: HOST_ID,
            presence: presence('a'),
            from: { host: FROM_ROOM, presence: presence('from-remainder') },
            to: TO,
        }])
    })

    it('emits a first placement as a move from nowhere', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
            froms: [],
            to: TO_ROOM,
            presenceMoves: [{ presence: presence('root'), from: null, to: TO }],
        })

        expect(steps).toEqual([expect.objectContaining({ kind: 'movePresenceBinding', presence: presence('root'), from: null, to: TO })])
    })

    it('mints a root ahead of the move when the producer found the mover bindingless', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
            froms: [],
            to: TO_ROOM,
            presenceMoves: [{ presence: presence('fresh'), from: null, to: TO }],
            mintedRootUuid: 'fresh',
        })

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'movePresenceBinding'])
        expect(steps[0]).toEqual({ kind: 'addPresenceBinding', hostId: HOST_ID, presenceUuid: 'fresh' })
    })

    it('follows several moves with a join of each extra binding into the first (a multi-from scrub)', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
            froms: [FROM_ROOM, OTHER_FROM],
            to: TO_ROOM,
            presenceMoves: [
                { presence: presence('a'), from: { host: FROM_ROOM }, to: TO },
                { presence: presence('b'), from: { host: OTHER_FROM }, to: TO },
            ],
        })

        expect(steps.map((step) => step.kind)).toEqual(['movePresenceBinding', 'movePresenceBinding', 'joinPresenceBindings'])
        expect(steps[2]).toEqual({ kind: 'joinPresenceBindings', hostId: HOST_ID, survivor: presence('a'), absorbed: presence('b') })
    })

    it('emits one release for a departure to no host', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, { froms: [FROM_ROOM, OTHER_FROM], to: null, presenceMoves: [] })

        expect(steps).toEqual([{ kind: 'releasePresenceBindings', hostId: HOST_ID }])
    })

    it('emits nothing when there is neither a departure nor a destination', () => {
        expect(presenceBindingStepsForMove(HOST_ID, { froms: [], to: null, presenceMoves: [] })).toEqual([])
    })
})
