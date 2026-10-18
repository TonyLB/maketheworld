import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingStepsForMove } from './presenceBindingStepsForMove'
import { parentRemainderKey } from '../../../ludicGraph/testFixtures'

const HOST_ID = 'OBJECT#Tray' as EphemeraObjectId
const FROM_ROOM = 'ROOM#Departure' as EphemeraRoomId
const OTHER_FROM = 'ROOM#Third' as EphemeraRoomId
const TO_ROOM = 'ROOM#Arrival' as EphemeraRoomId
const presence = (name: string) => `PRESENCE#${name}` as EphemeraPresenceNodeId
const TO = { host: TO_ROOM, presence: presence('arrival-remainder') }

describe('presenceBindingStepsForMove', () => {
    it('emits one move per named binding, carrying the producer\'s bindings verbatim', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
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
            presenceMoves: [{ presence: presence('root'), from: null, to: TO }],
        })

        expect(steps).toEqual([expect.objectContaining({ kind: 'movePresenceBinding', presence: presence('root'), from: null, to: TO })])
    })

    it('mints a root ahead of the move when the producer found the mover bindingless', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
            presenceMoves: [{ presence: presence('fresh'), from: null, to: TO }],
            mintedRootUuid: 'fresh',
        })

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'movePresenceBinding'])
        expect(steps[0]).toEqual({ kind: 'addPresenceBinding', hostId: HOST_ID, presenceUuid: 'fresh' })
    })

    it('emits one move per binding, each after the first carrying its cover, with no join (a multi-from scrub)', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
            presenceMoves: [
                { presence: presence('a'), from: { host: FROM_ROOM, presence: parentRemainderKey(FROM_ROOM) }, to: TO },
                { presence: presence('b'), from: { host: OTHER_FROM, presence: parentRemainderKey(OTHER_FROM) }, to: TO, cover: { members: [{ host: FROM_ROOM, presence: presence('c') }] } },
            ],
        })

        expect(steps.map((step) => step.kind)).toEqual(['movePresenceBinding', 'movePresenceBinding'])
        expect(steps[0]).not.toHaveProperty('cover')
        expect(steps[1]).toEqual(expect.objectContaining({ presence: presence('b'), cover: { members: [{ host: FROM_ROOM, presence: presence('c') }] } }))
    })

    it('emits one release per departing binding, after any moves', () => {
        const steps = presenceBindingStepsForMove(HOST_ID, {
            presenceMoves: [
                { presence: presence('a'), from: { host: FROM_ROOM, presence: presence('from-remainder') }, to: null },
                { presence: presence('b'), from: { host: OTHER_FROM, presence: parentRemainderKey(OTHER_FROM) }, to: null },
            ],
        })

        expect(steps).toEqual([
            { kind: 'movePresenceBinding', to: null, hostId: HOST_ID, presence: presence('a'), from: { host: FROM_ROOM, presence: presence('from-remainder') } },
            { kind: 'movePresenceBinding', to: null, hostId: HOST_ID, presence: presence('b'), from: { host: OTHER_FROM, presence: parentRemainderKey(OTHER_FROM) } },
        ])
    })

    it('emits nothing when the producer named no binding', () => {
        expect(presenceBindingStepsForMove(HOST_ID, { presenceMoves: [] })).toEqual([])
    })
})
