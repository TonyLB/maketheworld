import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { containmentDriftParentsOf, containmentPopulationDriftSweep } from './index'

const AREA_ID = 'AREA#Overworld'
const ROOM_ID = 'ROOM#Kitchen'
const OTHER_ROOM_ID = 'ROOM#Cafe'
const FEATURE_ID = 'FEATURE#Stove'
const CHARACTER_ID = 'CHARACTER#Alpha'

const graphWith = (...nodes: object[]) => ({ nodes })
const remainder = { members: [{ tag: 'Remainder' }] }
const roomRoot = { tag: 'Presence', universalKey: 'PRESENCE#root', cover: remainder }
const areaPointer = { host: AREA_ID, presence: 'PRESENCE#area-root' }

describe('containmentDriftParentsOf', () => {
    it('(a) flags a pointer naming no parent binding, an Area parent included', () => {
        expect(containmentDriftParentsOf(FEATURE_ID, graphWith(
            { tag: 'Presence', universalKey: 'PRESENCE#b', fromHostPresence: { host: ROOM_ID }, cover: remainder }
        ))).toEqual([ROOM_ID])
        expect(containmentDriftParentsOf(ROOM_ID, graphWith(
            roomRoot,
            { tag: 'Presence', universalKey: 'PRESENCE#b', fromHostPresence: { host: AREA_ID }, cover: { members: [] } }
        ))).toEqual([AREA_ID])
    })

    it('(b) flags a Room\'s Area binding that is not an empty-member carve-out', () => {
        expect(containmentDriftParentsOf(ROOM_ID, graphWith(
            roomRoot,
            { tag: 'Presence', universalKey: 'PRESENCE#c', fromHostPresence: areaPointer, cover: remainder }
        ))).toEqual([AREA_ID])
    })

    it('passes a current-shape binding, a hostless remainder, and non-Room/Feature owners', () => {
        expect(containmentDriftParentsOf(FEATURE_ID, graphWith(
            { tag: 'Presence', universalKey: 'PRESENCE#d', fromHostPresence: { host: ROOM_ID, presence: 'PRESENCE#r' }, cover: remainder }
        ))).toEqual([])
        expect(containmentDriftParentsOf(ROOM_ID, graphWith(roomRoot))).toEqual([])
        expect(containmentDriftParentsOf(ROOM_ID, graphWith(
            roomRoot,
            { tag: 'Presence', universalKey: 'PRESENCE#b', fromHostPresence: areaPointer, cover: { members: [] } }
        ))).toEqual([])
        expect(containmentDriftParentsOf(AREA_ID, graphWith(roomRoot))).toEqual([])
        expect(containmentDriftParentsOf(CHARACTER_ID, graphWith(
            { tag: 'Presence', universalKey: 'PRESENCE#e', fromHostPresence: { host: ROOM_ID }, cover: remainder }
        ))).toEqual([])
        expect(containmentDriftParentsOf(FEATURE_ID, undefined)).toEqual([])
    })

    it('(c) flags a Room with no hostless remainder as its own parent, including one with no stored graph', () => {
        expect(containmentDriftParentsOf(ROOM_ID, graphWith({ tag: 'Room', universalKey: ROOM_ID }))).toEqual([ROOM_ID])
        expect(containmentDriftParentsOf(ROOM_ID, undefined)).toEqual([ROOM_ID])
        expect(containmentDriftParentsOf(ROOM_ID, graphWith(
            { tag: 'Presence', universalKey: 'PRESENCE#k', fromHostPresence: areaPointer, cover: { members: [] } }
        ))).toEqual([ROOM_ID])
    })

    it('(c) flags an Area with no hostless remainder as its own parent', () => {
        expect(containmentDriftParentsOf(AREA_ID, graphWith({ tag: 'Room', universalKey: ROOM_ID }))).toEqual([AREA_ID])
        expect(containmentDriftParentsOf(AREA_ID, undefined)).toEqual([AREA_ID])
    })
})

describe('containmentPopulationDriftSweep', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits one sorted, deduplicated finding per drifted parent', async () => {
        const result = await containmentPopulationDriftSweep(
            { diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000 },
            {
                listCandidateRows: async () => [
                    {
                        EphemeraId: ROOM_ID,
                        DataCategory: 'Meta::Room',
                        ludicGraph: graphWith(roomRoot, { tag: 'Presence', universalKey: 'PRESENCE#k', fromHostPresence: { host: AREA_ID }, cover: remainder }),
                    },
                    {
                        EphemeraId: OTHER_ROOM_ID,
                        DataCategory: 'Meta::Room',
                        ludicGraph: graphWith(roomRoot, { tag: 'Presence', universalKey: 'PRESENCE#c', fromHostPresence: areaPointer, cover: { members: [] } }),
                    },
                    {
                        EphemeraId: FEATURE_ID,
                        DataCategory: 'Meta::Feature',
                        ludicGraph: graphWith({ tag: 'Presence', universalKey: 'PRESENCE#s', fromHostPresence: { host: ROOM_ID }, cover: remainder }),
                    },
                    {
                        EphemeraId: 'FEATURE#Sink',
                        DataCategory: 'Meta::Feature',
                        ludicGraph: graphWith({ tag: 'Presence', universalKey: 'PRESENCE#t', fromHostPresence: { host: ROOM_ID, presence: 'PRESENCE#r' }, cover: remainder }),
                    },
                ],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 2, ephemeraIds: [AREA_ID, ROOM_ID] })
        expect(emitFinding).toHaveBeenCalledTimes(2)
        expect(emitFinding).toHaveBeenCalledWith({
            ephemeraId: AREA_ID,
            diagnosticRunId: 'run-1',
            nowMs: 1_700_000_000_000,
            eventBusName: 'test-bus',
        })
    })

    it('emits nothing over clean rows', async () => {
        const result = await containmentPopulationDriftSweep({}, {
            listCandidateRows: async () => [{
                EphemeraId: ROOM_ID,
                DataCategory: 'Meta::Room',
                ludicGraph: graphWith(
                    roomRoot,
                    { tag: 'Presence', universalKey: 'PRESENCE#k', fromHostPresence: areaPointer, cover: { members: [] } },
                ),
            }, {
                EphemeraId: AREA_ID,
                DataCategory: 'Meta::Area',
                ludicGraph: graphWith(roomRoot),
            }],
            emitFinding,
        })

        expect(result).toEqual({ emittedCount: 0, ephemeraIds: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('throws without EVENT_BUS_NAME', async () => {
        delete process.env.EVENT_BUS_NAME
        await expect(containmentPopulationDriftSweep({}, { listCandidateRows: async () => [], emitFinding })).rejects.toThrow('EVENT_BUS_NAME')
    })
})
