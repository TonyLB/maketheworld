import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { presenceCoverDriftSweep } from './index'

const row = (id: string, category: string, ...nodes: object[]) => ({ EphemeraId: id, DataCategory: category, ludicGraph: { nodes: [{ tag: category.slice(6), universalKey: id }, ...nodes] } })
const root = { tag: 'Presence', universalKey: 'PRESENCE#Base', cover: { members: [] } }
const rootCovers = { ...root, cover: { members: [{ host: 'FEATURE#Stove', presence: 'PRESENCE#Base' }] } }
const carve = (members: object[]) => ({ tag: 'Presence', universalKey: 'PRESENCE#carve', fromHostPresence: { host: 'AREA#Town', presence: 'PRESENCE#top' }, cover: { members } })
const pointer = (key: string, presence: string) => ({ tag: 'Presence', universalKey: key, fromHostPresence: { host: 'ROOM#Kitchen', presence }, cover: { members: [] } })
const feature = { tag: 'Feature', universalKey: 'FEATURE#Stove' }

describe('presenceCoverDriftSweep', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits one finding per whole whose cover disagrees with its members\' pointers', async () => {
        const result = await presenceCoverDriftSweep({ diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000 }, {
            listCandidateRows: async () => [
                row('ROOM#Kitchen', 'Meta::Room', feature, root, carve([])),
                row('FEATURE#Stove', 'Meta::Feature', pointer('PRESENCE#Base', 'PRESENCE#carve')),
            ],
            emitFinding,
        })
        expect(result).toMatchObject({ emittedCount: 1, ephemeraIds: ['ROOM#Kitchen'] })
        expect(emitFinding).toHaveBeenCalledWith({ ephemeraId: 'ROOM#Kitchen', diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000, eventBusName: 'test-bus' })
    })

    it('reads zero over a healed cover', async () => {
        const result = await presenceCoverDriftSweep({}, {
            listCandidateRows: async () => [
                row('ROOM#Kitchen', 'Meta::Room', feature, root, carve([{ host: 'FEATURE#Stove', presence: 'PRESENCE#Base' }])),
                row('FEATURE#Stove', 'Meta::Feature', pointer('PRESENCE#Base', 'PRESENCE#carve')),
            ],
            emitFinding,
        })
        expect(result).toEqual({ emittedCount: 0, ephemeraIds: [], unrepairable: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('lists unbound members and wholes with no Base as unrepairable, while the stale entry that names an unbound member is still healable', async () => {
        const result = await presenceCoverDriftSweep({}, {
            listCandidateRows: async () => [
                row('ROOM#Kitchen', 'Meta::Room', feature, rootCovers),
                row('FEATURE#Stove', 'Meta::Feature'),
                row('ROOM#Cafe', 'Meta::Room', feature, carve([{ host: 'FEATURE#Stove', presence: 'PRESENCE#x' }])),
            ],
            emitFinding,
        })
        expect(result.ephemeraIds).toEqual(['ROOM#Cafe', 'ROOM#Kitchen'])
        expect(result.unrepairable.map((entry) => [entry.ephemeraId, entry.noBase, entry.findings.map((f) => f.kind)]))
            .toEqual([['ROOM#Cafe', true, ['Unbound']], ['ROOM#Kitchen', false, ['Unbound']]])
    })

    it('throws without EVENT_BUS_NAME', async () => {
        delete process.env.EVENT_BUS_NAME
        await expect(presenceCoverDriftSweep({}, { listCandidateRows: async () => [], emitFinding })).rejects.toThrow('EVENT_BUS_NAME')
    })

    it('reports a second hostless binding as unrepairable, never as a healable finding', async () => {
        const second = { tag: 'Presence', universalKey: 'PRESENCE#second', cover: { members: [] } }
        const result = await presenceCoverDriftSweep({}, {
            listCandidateRows: async () => [row('ROOM#Kitchen', 'Meta::Room', root, second)],
            emitFinding,
        })
        expect(result).toMatchObject({ emittedCount: 0, unrepairable: [{ ephemeraId: 'ROOM#Kitchen', findings: [{ kind: 'SecondHostless', presence: 'PRESENCE#second' }] }] })
        expect(emitFinding).not.toHaveBeenCalled()
    })
})
