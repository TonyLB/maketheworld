import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import { audienceBuckets, defaultReading, readingsOf, type PresencePlacement } from './objectViews'

const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const ropeId = 'OBJECT#Rope' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const base = PresenceKey('base')
const tableBinding = PresenceKey('table')
const [one, two, three] = [PresenceKey('one'), PresenceKey('two'), PresenceKey('three')]

describe('audienceBuckets', () => {
    it('flattens runs in order, one bucket per binding', () => {
        const placement: PresencePlacement[] = [
            { host: roomA, bindings: [{ presence: base }] },
            { host: ropeId, bindings: [{ presence: one, under: [{ host: roomA, presence: base }], rooms: [roomA] }, { presence: two }] },
        ]

        expect(audienceBuckets(placement)).toEqual([
            { host: roomA, presence: base },
            { host: ropeId, presence: one },
            { host: ropeId, presence: two },
        ])
    })

    it('names the room itself where the object sits in the room\'s own graph with no binding', () => {
        expect(audienceBuckets([{ host: roomA, bindings: [] }])).toEqual([roomA])
    })
})

describe('readingsOf', () => {
    const under = (host: EphemeraObjectId | EphemeraRoomId, presence = base) => [{ host, presence }]

    it('reads each own binding under a different parent as its own reading', () => {
        const placement: PresencePlacement[] = [
            { host: ropeId, bindings: [{ presence: one, under: under(roomA), rooms: [roomA] }, { presence: two, under: under(tableId, tableBinding), rooms: [roomA] }] },
        ]

        expect(readingsOf(ropeId, placement).map(({ bindings }) => bindings)).toEqual([[one], [two]])
    })

    // The kernel forbids two bindings under one parent today (OD-6), so this is a rule recorded, not a world built.
    it('reads own bindings under the same parent as one reading', () => {
        const placement: PresencePlacement[] = [
            { host: ropeId, bindings: [{ presence: one, under: under(roomA), rooms: [roomA] }, { presence: two, under: under(roomA), rooms: [roomA] }, { presence: three, under: under(tableId, tableBinding), rooms: [roomA] }] },
        ]

        expect(readingsOf(ropeId, placement).map(({ bindings }) => bindings)).toEqual([[one, two], [three]])
    })

    it('does not read a host\'s binding that holds the object as a reading of it', () => {
        expect(readingsOf(ropeId, [{ host: tableId, bindings: [{ presence: tableBinding }] }])).toEqual([])
    })

    it('has no readings for an object in the room\'s own graph, which reads as the whole', () => {
        expect(readingsOf(ropeId, [{ host: roomA, bindings: [] }])).toEqual([])
    })
})

describe('defaultReading', () => {
    const across: PresencePlacement[] = [
        { host: ropeId, bindings: [{ presence: one, under: [{ host: roomA, presence: base }], rooms: [roomA] }, { presence: two, under: [{ host: roomB, presence: base }], rooms: [roomB] }] },
    ]

    it('is the one reading at the actor\'s room', () => {
        expect(defaultReading(ropeId, across, roomB)?.bindings).toEqual([two])
    })

    it('is nothing when several readings are at the actor\'s room (the command asks)', () => {
        const spread: PresencePlacement[] = [
            { host: ropeId, bindings: [{ presence: one, under: [{ host: roomA, presence: base }], rooms: [roomA] }, { presence: two, under: [{ host: tableId, presence: tableBinding }], rooms: [roomA] }] },
        ]

        expect(defaultReading(ropeId, spread, roomA)).toBeUndefined()
    })

    it('is nothing when no reading reaches the actor\'s room (the whole object, as today)', () => {
        expect(defaultReading(ropeId, across, 'ROOM#Elsewhere' as EphemeraRoomId)).toBeUndefined()
    })
})
