import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { exitSpanPool } from './exitSpanPool'

const north = 'ROOM#North' as EphemeraRoomId
const attic = 'ROOM#Attic' as EphemeraRoomId

describe('exitSpanPool', () => {
    it('grounds an exit name exactly, to the room it leads to, named by the exit', () => {
        expect(exitSpanPool('north', [{ normalizedName: 'north', targetId: north }])).toEqual({
            span: 'north',
            candidates: [{ id: north, label: 'north', jointRelevance: 1, lexRelevance: 1, sourceTags: ['exact'], locus: { kind: 'room' } }],
        })
    })

    it('ignores case and spacing, and reads a multi-word name whole', () => {
        const exits = [{ normalizedName: 'north door', targetId: north }]
        expect(exitSpanPool('  North   DOOR ', exits).candidates.map(({ id }) => id)).toEqual([north])
    })

    it('grounds nothing that is not an exit name: no fuzzy match, no word inside a name', () => {
        const exits = [{ normalizedName: 'north door', targetId: north }]
        expect(exitSpanPool('nort', exits).candidates).toEqual([])
        expect(exitSpanPool('door', exits).candidates).toEqual([])
        expect(exitSpanPool('take cup', exits).candidates).toEqual([])
    })

    it('grounds nothing with no exits (out of a room)', () => {
        expect(exitSpanPool('north', []).candidates).toEqual([])
    })

    it('makes two exits of one name to one room one candidate, and to two rooms two', () => {
        expect(exitSpanPool('north', [{ normalizedName: 'north', targetId: north }, { normalizedName: 'north', targetId: north }]).candidates).toHaveLength(1)
        expect(exitSpanPool('north', [{ normalizedName: 'north', targetId: north }, { normalizedName: 'north', targetId: attic }]).candidates.map(({ id }) => id)).toEqual([north, attic])
    })
})
