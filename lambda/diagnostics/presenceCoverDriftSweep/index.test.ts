import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { presenceCoverDriftSweep } from './index'

const remainder = { members: [{ tag: 'Remainder' }] }
const row = (id: string, category: string, ...nodes: object[]) => ({ EphemeraId: id, DataCategory: category, ludicGraph: { nodes: [{ tag: category.slice(6), universalKey: id }, ...nodes] } })
const root = { tag: 'Presence', universalKey: 'PRESENCE#root', cover: remainder }
const carve = (members: object[]) => ({ tag: 'Presence', universalKey: 'PRESENCE#carve', cover: { members } })
const pointer = (key: string, presence: string) => ({ tag: 'Presence', universalKey: key, fromHostPresence: { host: 'ROOM#Kitchen', presence }, cover: remainder })
const feature = { tag: 'Feature', universalKey: 'FEATURE#Stove' }

describe('presenceCoverDriftSweep', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits one finding per whole whose remainder-free cover disagrees with its members\' pointers', async () => {
        const result = await presenceCoverDriftSweep({ diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000 }, {
            listCandidateRows: async () => [
                row('ROOM#Kitchen', 'Meta::Room', feature, root, carve([])),
                row('FEATURE#Stove', 'Meta::Feature', pointer('PRESENCE#f', 'PRESENCE#carve')),
            ],
            emitFinding,
        })
        expect(result).toMatchObject({ emittedCount: 1, ephemeraIds: ['ROOM#Kitchen'] })
        expect(emitFinding).toHaveBeenCalledWith({ ephemeraId: 'ROOM#Kitchen', diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000, eventBusName: 'test-bus' })
    })

    it('reads zero over a healed cover and clean remainder wholes', async () => {
        const result = await presenceCoverDriftSweep({}, {
            listCandidateRows: async () => [
                row('ROOM#Kitchen', 'Meta::Room', feature, root, carve([{ host: 'FEATURE#Stove', presence: 'PRESENCE#f' }])),
                row('FEATURE#Stove', 'Meta::Feature', pointer('PRESENCE#f', 'PRESENCE#carve')),
            ],
            emitFinding,
        })
        expect(result).toEqual({ emittedCount: 0, ephemeraIds: [], unrepairable: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('lists unbound members and remainder-free wholes as unrepairable; a stale cover entry is still healable', async () => {
        const result = await presenceCoverDriftSweep({}, {
            listCandidateRows: async () => [
                row('ROOM#Kitchen', 'Meta::Room', feature, root),
                row('FEATURE#Stove', 'Meta::Feature'),
                row('ROOM#Cafe', 'Meta::Room', feature, carve([{ host: 'FEATURE#Stove', presence: 'PRESENCE#x' }])),
            ],
            emitFinding,
        })
        expect(result.ephemeraIds).toEqual(['ROOM#Cafe'])
        expect(result.unrepairable.map((entry) => [entry.ephemeraId, entry.noRemainder, entry.findings.map((f) => f.kind)]))
            .toEqual([['ROOM#Cafe', true, ['Unbound']], ['ROOM#Kitchen', false, ['Unbound']]])
    })

    it('throws without EVENT_BUS_NAME', async () => {
        delete process.env.EVENT_BUS_NAME
        await expect(presenceCoverDriftSweep({}, { listCandidateRows: async () => [], emitFinding })).rejects.toThrow('EVENT_BUS_NAME')
    })
})
