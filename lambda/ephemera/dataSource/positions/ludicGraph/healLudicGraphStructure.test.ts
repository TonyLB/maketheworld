import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { healLudicGraphStructure } from './healLudicGraphStructure'

const ROOM_ID = 'ROOM#Kitchen' as EphemeraRoomId

describe('healLudicGraphStructure', () => {
    it('reports stale: false and writes nothing when the graph is absent (not yet written)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => undefined,
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('reports stale: false and writes nothing when the graph already has its root node present (idempotent)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('dry-run reports the exact repair without writing (LP4i proving case: missing root node)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: true }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({
            stale: true,
            healable: true,
            applied: false,
            repairedPayload: {
                rootId: ROOM_ID,
                nodes: [
                    { tag: 'Room', universalKey: ROOM_ID },
                    { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
                ],
            },
        })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('commit mode writes the repaired payload and reports applied: true', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha' }],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome.stale).toBe(true)
        expect(outcome).toMatchObject({ healable: true, applied: true })
        expect(writeHealedLudicGraph).toHaveBeenCalledTimes(1)
        expect(writeHealedLudicGraph).toHaveBeenCalledWith(ROOM_ID, {
            rootId: ROOM_ID,
            nodes: [
                { tag: 'Room', universalKey: ROOM_ID },
                { tag: 'Character', universalKey: 'CHARACTER#Alpha' },
            ],
        })
    })

    it('preserves edges and other nodes untouched while adding only the missing root node', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const edges = [{ tag: 'Relational' as const, from: 'OBJECT#broom', to: 'OBJECT#table', kind: 'On' as const }]
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [
                    { tag: 'Object', universalKey: 'OBJECT#broom' },
                    { tag: 'Object', universalKey: 'OBJECT#table' },
                ],
                edges,
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            stale: true,
            healable: true,
            repairedPayload: {
                rootId: ROOM_ID,
                nodes: [
                    { tag: 'Room', universalKey: ROOM_ID },
                    { tag: 'Object', universalKey: 'OBJECT#broom' },
                    { tag: 'Object', universalKey: 'OBJECT#table' },
                ],
                edges,
            },
        })
    })

    it('defaults a missing/invalid rootId to hostId, per premise 10 (recorded, never derived --- but this is the sanctioned one-time repair, not a read-boundary default)', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                nodes: [],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            stale: true,
            healable: true,
            repairedPayload: {
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
            },
        })
    })

    it('reports healable: false and writes nothing for staleness outside the healable set (e.g. a malformed node)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }, { tag: 'NotAKind', universalKey: 'OBJECT#x' }],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: true, healable: false, applied: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('reports healable: false for a non-object stored value', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => 'bogus',
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: true, healable: false, applied: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })
})
