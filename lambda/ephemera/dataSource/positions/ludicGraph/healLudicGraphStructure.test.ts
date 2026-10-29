import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { healLudicGraphStructure } from './healLudicGraphStructure'
import * as markStale from '../ludicCache/markStale'

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

    it('reports stale: false and writes nothing when the graph already has its root node and ports present (idempotent)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
                ports: [],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('dry-run reports the exact repair without writing (missing root node)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: true }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha', hostingKind: 'In' }],
                ports: [],
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
                    { tag: 'Character', universalKey: 'CHARACTER#Alpha', hostingKind: 'In' },
                ],
                ports: [],
            },
        })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('commit mode writes the repaired payload and reports applied: true', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha', hostingKind: 'In' }],
                ports: [],
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
                { tag: 'Character', universalKey: 'CHARACTER#Alpha', hostingKind: 'In' },
            ],
            ports: [],
        })
    })

    it('preserves edges and other nodes untouched while adding only the missing root node', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const edges = [{ tag: 'Relational' as const, from: 'OBJECT#broom', to: 'OBJECT#table', kind: 'ConnectedTo' as const }]
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [
                    { tag: 'Object', universalKey: 'OBJECT#broom', hostingKind: 'In' },
                    { tag: 'Object', universalKey: 'OBJECT#table', hostingKind: 'In' },
                ],
                edges,
                ports: [],
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
                    { tag: 'Object', universalKey: 'OBJECT#broom', hostingKind: 'In' },
                    { tag: 'Object', universalKey: 'OBJECT#table', hostingKind: 'In' },
                ],
                edges,
                ports: [],
            },
        })
    })

    it('defaults a missing/invalid rootId to hostId, recorded, never derived --- but this is the sanctioned one-time repair, not a read-boundary default', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                nodes: [],
                ports: [],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            stale: true,
            healable: true,
            repairedPayload: {
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
                ports: [],
            },
        })
    })

    it('reports healable: false and writes nothing for staleness outside the healable set (e.g. a malformed node)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }, { tag: 'NotAKind', universalKey: 'OBJECT#x' }],
                ports: [],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: true, healable: false, applied: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    // ports joins rootId/the root node as a third healable field, defaulted
    // to [] --- interim posture: absent means "not yet written," not "always empty."
    it('defaults a missing ports field to [] while leaving an otherwise-current graph alone', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            stale: true,
            healable: true,
            applied: true,
            repairedPayload: {
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
                ports: [],
            },
        })
        expect(writeHealedLudicGraph).toHaveBeenCalledWith(ROOM_ID, {
            rootId: ROOM_ID,
            nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
            ports: [],
        })
    })

    it('defaults a malformed ports value to [] rather than rejecting the whole row as unhealable', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
                ports: [{ portId: 'PORT-ab6129d', fromHostId: 'ASSET#bogus', kind: 'ConnectedTo' }],
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            stale: true,
            healable: true,
            repairedPayload: { ports: [] },
        })
    })

    it('preserves an already-well-formed ports array untouched', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const ports = [{ portId: 'PORT-ab6129d', fromHostId: 'OBJECT#box', kind: 'ConnectedTo' }]
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha', hostingKind: 'In' }],
                ports,
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            stale: true,
            healable: true,
            repairedPayload: {
                nodes: [
                    { tag: 'Room', universalKey: ROOM_ID },
                    { tag: 'Character', universalKey: 'CHARACTER#Alpha', hostingKind: 'In' },
                ],
                ports,
            },
        })
    })

    describe('the retired single fromHostPresence', () => {
        const heal = (nodes: unknown[]) => healLudicGraphStructure(ROOM_ID, { dryRun: true }, {
            getStoredLudicGraph: async () => ({ rootId: ROOM_ID, nodes: [{ tag: 'Room', universalKey: ROOM_ID }, ...nodes], ports: [] }),
            writeHealedLudicGraph: jest.fn(),
        })

        it('becomes a one-element fromHostPresences', async () => {
            const parent = { host: 'AREA#Town', presence: 'PRESENCE#Base' }
            const outcome = await heal([{ tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresence: parent, cover: { members: [] } }])
            expect(outcome).toMatchObject({ stale: true, healable: true })
            expect((outcome as any).repairedPayload.nodes[1]).toEqual({ tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresences: [parent], cover: { members: [] } })
        })

        it('becomes an empty fromHostPresences when the binding was hostless', async () => {
            const outcome = await heal([{ tag: 'Presence', universalKey: 'PRESENCE#Base', cover: { members: [] } }])
            expect(outcome).toMatchObject({ stale: true, healable: true })
            expect((outcome as any).repairedPayload.nodes[1]).toEqual({ tag: 'Presence', universalKey: 'PRESENCE#Base', fromHostPresences: [], cover: { members: [] } })
        })

        it('leaves a node that already holds fromHostPresences alone', async () => {
            const parents = [{ host: 'AREA#Town', presence: 'PRESENCE#Base' }]
            const outcome = await heal([{ tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresences: parents, cover: { members: [] } }])
            expect(outcome).toEqual({ stale: false })
        })

        it('stays unhealable when the old pointer is malformed (names a host but no presence)', async () => {
            const outcome = await heal([{ tag: 'Presence', universalKey: 'PRESENCE#a', fromHostPresence: { host: 'AREA#Town' }, cover: { members: [] } }])
            expect(outcome).toEqual({ stale: true, healable: false, applied: false })
        })
    })

    it('reports a referrer naming a missing edge id as unhealable corruption, writing nothing (ET-3)', async () => {
        const writeHealedLudicGraph = jest.fn()
        const outcome = await healLudicGraphStructure(ROOM_ID, { dryRun: false }, {
            getStoredLudicGraph: async () => ({
                rootId: ROOM_ID,
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
                ports: [],
                edges: [{ tag: 'Relational', kind: 'Justifies', from: { edgeId: 'gone-a' }, to: { edgeId: 'gone-b' } }],
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

    describe('stale-marking after the real write', () => {
        const optimisticUpdate = jest.spyOn(ephemeraDB, 'optimisticUpdate')
        const markHostsStale = jest.spyOn(markStale, 'markHostsStale')

        beforeEach(() => {
            optimisticUpdate.mockReset().mockResolvedValue(undefined as any)
            markHostsStale.mockReset().mockResolvedValue([])
        })

        afterAll(() => {
            optimisticUpdate.mockRestore()
            markHostsStale.mockRestore()
        })

        const staleGraph = { rootId: ROOM_ID, nodes: [{ tag: 'Character', universalKey: 'CHARACTER#Alpha', hostingKind: 'In' }], ports: [] }

        it('marks the healed host\'s rooms right after its own write', async () => {
            await healLudicGraphStructure(ROOM_ID, { dryRun: false }, { getStoredLudicGraph: async () => staleGraph })
            expect(optimisticUpdate).toHaveBeenCalledTimes(1)
            expect(markHostsStale).toHaveBeenCalledWith([ROOM_ID])
            expect(optimisticUpdate.mock.invocationCallOrder[0]).toBeLessThan(markHostsStale.mock.invocationCallOrder[0])
        })

        it('marks nothing on a dry run or a graph that is not stale', async () => {
            await healLudicGraphStructure(ROOM_ID, { dryRun: true }, { getStoredLudicGraph: async () => staleGraph })
            await healLudicGraphStructure(ROOM_ID, { dryRun: false }, { getStoredLudicGraph: async () => undefined })
            expect(markHostsStale).not.toHaveBeenCalled()
        })
    })
})
