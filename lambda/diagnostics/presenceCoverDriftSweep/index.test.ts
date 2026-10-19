import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { presenceCoverDriftSweep } from './index'

const row = (id: string, category: string, ...nodes: object[]) => ({ EphemeraId: id, DataCategory: category, ludicGraph: { nodes: [{ tag: category.slice(6), universalKey: id }, ...nodes] } })
const root = { tag: 'Presence', universalKey: 'PRESENCE#Base', cover: { members: [] } }
const rootCovers = { ...root, cover: { members: [{ host: 'FEATURE#Stove', presence: 'PRESENCE#Base' }] } }
const carve = (members: object[]) => ({ tag: 'Presence', universalKey: 'PRESENCE#carve', fromHostPresence: { host: 'AREA#Town', presence: 'PRESENCE#Base' }, cover: { members } })
const pointer = (key: string, presence: string) => ({ tag: 'Presence', universalKey: key, fromHostPresence: { host: 'ROOM#Kitchen', presence }, cover: { members: [] } })
const feature = { tag: 'Feature', universalKey: 'FEATURE#Stove' }
// The area the carve-out binding points at, so those fixtures hold no orphan.
const town = (...rooms: string[]) => row('AREA#Town', 'Meta::Area', ...rooms.map((universalKey) => ({ tag: 'Room', universalKey })),
    { ...root, cover: { members: rooms.map((host) => ({ host, presence: 'PRESENCE#carve' })) } })

describe('presenceCoverDriftSweep', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits one finding per whole whose cover disagrees with its members\' pointers', async () => {
        const result = await presenceCoverDriftSweep({ diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000 }, {
            listCandidateRows: async () => [
                town('ROOM#Kitchen'),
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
                town('ROOM#Kitchen'),
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
                town('ROOM#Cafe'),
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

    describe('orphaned pointers', () => {
        const objectAt = (host: string, presence: string) => row('OBJECT#Cup', 'Meta::Object', root, { tag: 'Presence', universalKey: 'PRESENCE#cup', fromHostPresence: { host, presence }, cover: { members: [] } })

        it('emits a finding on the member whose pointer names a host that lacks its node', async () => {
            const result = await presenceCoverDriftSweep({}, {
                listCandidateRows: async () => [row('FEATURE#Stove', 'Meta::Feature', root), objectAt('FEATURE#Stove', 'PRESENCE#Base')],
                emitFinding,
            })
            expect(result).toMatchObject({ emittedCount: 1, ephemeraIds: ['OBJECT#Cup'], unrepairable: [] })
        })

        it('reads zero once the host holds the node and the cover entry', async () => {
            const covered = { ...root, cover: { members: [{ host: 'OBJECT#Cup', presence: 'PRESENCE#cup' }] } }
            const result = await presenceCoverDriftSweep({}, {
                listCandidateRows: async () => [row('FEATURE#Stove', 'Meta::Feature', { tag: 'Object', universalKey: 'OBJECT#Cup' }, covered), objectAt('FEATURE#Stove', 'PRESENCE#Base')],
                emitFinding,
            })
            expect(result).toEqual({ emittedCount: 0, ephemeraIds: [], unrepairable: [] })
        })

        it('lists an orphan whose host row is missing as unrepairable, never emitted', async () => {
            const result = await presenceCoverDriftSweep({}, {
                listCandidateRows: async () => [objectAt('FEATURE#Gone', 'PRESENCE#Base')],
                emitFinding,
            })
            expect(result).toMatchObject({ emittedCount: 0, unrepairable: [{ ephemeraId: 'OBJECT#Cup', findings: [{ kind: 'Orphaned', host: 'FEATURE#Gone' }] }] })
            expect(emitFinding).not.toHaveBeenCalled()
        })
    })
})
