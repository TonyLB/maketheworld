import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import { audienceBuckets, defaultReading, placementHostsOfView, readingLabel, readingsOf, wholeReadingLabel, type PresencePlacement } from './objectViews'

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

describe('readingLabel', () => {
    const naming = { actorRoom: roomA, nameOf: (host: string) => (host === tableId ? 'table' : undefined) }
    const reading = (under: { host: EphemeraObjectId | EphemeraRoomId; presence: typeof base }[], rooms: EphemeraRoomId[] = [roomA]) => ({ bindings: [one], under, rooms })

    it('names a part on an object and a part in the actor\'s room', () => {
        expect(readingLabel('cloth', reading([{ host: tableId, presence: tableBinding }]), naming)).toBe('the cloth on the table')
        expect(readingLabel('cloth', reading([{ host: roomA, presence: base }]), naming)).toBe('the cloth in the room')
    })

    it('names a part in some other room without a room name', () => {
        expect(readingLabel('rope', reading([{ host: roomB, presence: base }], [roomB]), naming)).toBe('the rope in another room')
    })

    it('falls back to the bare name when no parent has a name to give', () => {
        expect(readingLabel('cloth', reading([{ host: 'OBJECT#Unnamed' as EphemeraObjectId, presence: base }]), naming)).toBe('cloth')
    })

    it('words the whole', () => {
        expect(wholeReadingLabel('cloth')).toBe('both parts of the cloth')
    })
})

describe('placementHostsOfView', () => {
    const placement: PresencePlacement[] = [
        { host: tableId, bindings: [{ presence: tableBinding }] },
        { host: ropeId, bindings: [
            { presence: one, under: [{ host: roomA, presence: base }], rooms: [roomA] },
            { presence: two, under: [{ host: tableId, presence: tableBinding }], rooms: [roomA] },
            { presence: three, under: [{ host: roomB, presence: base }, { host: tableId, presence: tableBinding }], rooms: [roomA, roomB] },
        ] },
    ]

    it('lists the distinct hosts the view\'s bindings sit under, in view order, reading only the object\'s own run', () => {
        expect(placementHostsOfView(ropeId, placement, [two, one])).toEqual([tableId, roomA])
        expect(placementHostsOfView(ropeId, placement, [three, two])).toEqual([roomB, tableId])
    })

    it('is undefined where the placement lacks a binding the view names', () => {
        expect(placementHostsOfView(ropeId, placement, [one, PresenceKey('gone')])).toBeUndefined()
        expect(placementHostsOfView(ropeId, placement, [tableBinding])).toBeUndefined()
    })
})

describe('defaultReading with the actor known', () => {
    const actor = 'CHARACTER#Tess' as const
    const held = { presence: two, under: [{ host: actor, presence: base }], rooms: [] }

    it('counts a part held by the actor as at the actor\'s position, though its walk reaches no room', () => {
        const placement: PresencePlacement[] = [{ host: ropeId, bindings: [held, { presence: one, under: [{ host: roomB, presence: base }], rooms: [roomB] }] }]

        expect(defaultReading(ropeId, placement, roomA)).toBeUndefined()
        expect(defaultReading(ropeId, placement, roomA, actor)?.bindings).toEqual([two])
    })

    it('finds no single default where a held part and a part in the actor\'s room are both at its position', () => {
        const placement: PresencePlacement[] = [{ host: ropeId, bindings: [held, { presence: one, under: [{ host: roomA, presence: base }], rooms: [roomA] }] }]

        expect(defaultReading(ropeId, placement, roomA, actor)).toBeUndefined()
    })

    it('labels the held part as in the actor\'s hands', () => {
        const [reading] = readingsOf(ropeId, [{ host: ropeId, bindings: [held] }])

        expect(readingLabel('rope', reading!, { actorRoom: roomA, actorCharacter: actor, nameOf: () => undefined })).toBe('the rope in your hands')
    })
})
