import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { fixedContainmentDriftSweep } from './index'

const AREA_ID = 'AREA#Overworld'
const ROOM_ID = 'ROOM#Kitchen'
const FEATURE_ID = 'FEATURE#Stove'

const root = { tag: 'Presence', universalKey: 'PRESENCE#Base', cover: { members: [] } }
const carveOut = {
    nodes: [root, { tag: 'Presence', universalKey: 'PRESENCE#c', fromHostPresences: [{ host: AREA_ID, presence: 'PRESENCE#Base' }], cover: { members: [] } }],
}
const cleanArea = { nodes: [root, ROOM_ID], edges: [{ tag: 'Relational', kind: 'PartOf', from: ROOM_ID, to: AREA_ID }] }
const authored: Record<string, string[]> = { [AREA_ID]: [ROOM_ID] }

describe('fixedContainmentDriftSweep', () => {
    const emitFinding = jest.fn(async () => undefined)
    const listAuthoredChildren = jest.fn(async (parentId: string) => authored[parentId] ?? [])

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits nothing over a clean, fully populated nesting', async () => {
        const result = await fixedContainmentDriftSweep({}, {
            listCandidateRows: async () => [
                { EphemeraId: AREA_ID, DataCategory: 'Meta::Area', ludicGraph: cleanArea },
                { EphemeraId: ROOM_ID, DataCategory: 'Meta::Room', ludicGraph: carveOut },
            ],
            listAuthoredChildren,
            emitFinding,
        })

        expect(result).toEqual({ emittedCount: 0, ephemeraIds: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('finds an authored child that was never populated, and emits one sorted finding per drifted parent', async () => {
        const result = await fixedContainmentDriftSweep(
            { diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000 },
            {
                listCandidateRows: async () => [
                    // Area declares ROOM_ID but its row holds neither node, edge nor child binding
                    { EphemeraId: AREA_ID, DataCategory: 'Meta::Area', ludicGraph: { nodes: [root] } },
                    { EphemeraId: ROOM_ID, DataCategory: 'Meta::Room', ludicGraph: { nodes: [root] } },
                    // a Room with no root is its own drifted parent
                    { EphemeraId: 'ROOM#Bare', DataCategory: 'Meta::Room', ludicGraph: { nodes: [] } },
                    { EphemeraId: FEATURE_ID, DataCategory: 'Meta::Feature' },
                ],
                listAuthoredChildren,
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 2, ephemeraIds: [AREA_ID, 'ROOM#Bare'] })
        expect(emitFinding).toHaveBeenCalledTimes(2)
        expect(emitFinding).toHaveBeenCalledWith({
            ephemeraId: AREA_ID,
            diagnosticRunId: 'run-1',
            nowMs: 1_700_000_000_000,
            eventBusName: 'test-bus',
        })
    })

    it('still fires for a root-less Room that also has bindings (the deliberate overlap with noBase)', async () => {
        const result = await fixedContainmentDriftSweep({}, {
            listCandidateRows: async () => [{
                EphemeraId: ROOM_ID,
                DataCategory: 'Meta::Room',
                ludicGraph: { nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#k', fromHostPresences: [{ host: AREA_ID, presence: 'PRESENCE#Base' }], cover: { members: [] } }] },
            }],
            listAuthoredChildren,
            emitFinding,
        })
        expect(result.ephemeraIds).toEqual([ROOM_ID])
    })

    it('throws without EVENT_BUS_NAME', async () => {
        delete process.env.EVENT_BUS_NAME
        await expect(fixedContainmentDriftSweep({}, { listCandidateRows: async () => [], emitFinding })).rejects.toThrow('EVENT_BUS_NAME')
    })
})
