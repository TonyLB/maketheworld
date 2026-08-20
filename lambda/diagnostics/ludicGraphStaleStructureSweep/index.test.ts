import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ludicGraphStaleStructureSweep } from './index'

const ROOM_ID = 'ROOM#Kitchen' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('ludicGraphStaleStructureSweep', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits a finding for a row whose root is missing from nodes (LP4i proving case)', async () => {
        const result = await ludicGraphStaleStructureSweep(
            { diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000 },
            {
                listCandidateRows: async () => [{
                    EphemeraId: ROOM_ID,
                    DataCategory: 'Meta::Room',
                    ludicGraph: {
                        rootId: ROOM_ID,
                        nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }],
                    },
                }],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 1, ephemeraIds: [ROOM_ID] })
        expect(emitFinding).toHaveBeenCalledWith({
            ephemeraId: ROOM_ID,
            diagnosticRunId: 'run-1',
            nowMs: 1_700_000_000_000,
            eventBusName: 'test-bus',
        })
    })

    it('does not emit for a row whose root node is present', async () => {
        const result = await ludicGraphStaleStructureSweep(
            {},
            {
                listCandidateRows: async () => [{
                    EphemeraId: ROOM_ID,
                    DataCategory: 'Meta::Room',
                    ludicGraph: {
                        rootId: ROOM_ID,
                        nodes: [
                            { tag: 'Room', universalKey: ROOM_ID },
                            { tag: 'Character', universalKey: CHARACTER_ID },
                        ],
                    },
                }],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ephemeraIds: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('does not emit for a row with no stored ludicGraph (not yet written, not stale)', async () => {
        const result = await ludicGraphStaleStructureSweep(
            {},
            {
                listCandidateRows: async () => [{ EphemeraId: ROOM_ID, DataCategory: 'Meta::Room' }],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ephemeraIds: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('ignores a row whose EphemeraId is not a legal membership host id', async () => {
        const result = await ludicGraphStaleStructureSweep(
            {},
            {
                listCandidateRows: async () => [{
                    EphemeraId: 'BOGUS#not-a-host',
                    DataCategory: 'Meta::Room',
                    ludicGraph: { rootId: 'ROOM#Kitchen', nodes: [] },
                }],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ephemeraIds: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('flags multiple stale rows across host kinds and emits one finding each, sorted', async () => {
        const CHARACTER_HOST = 'CHARACTER#Beta' as EphemeraCharacterId
        const result = await ludicGraphStaleStructureSweep(
            { diagnosticRunId: 'run-multi', nowMs: 1000 },
            {
                listCandidateRows: async () => [
                    {
                        EphemeraId: CHARACTER_HOST,
                        DataCategory: 'Meta::Character',
                        ludicGraph: { rootId: CHARACTER_HOST, nodes: [] },
                    },
                    {
                        EphemeraId: ROOM_ID,
                        DataCategory: 'Meta::Room',
                        ludicGraph: {
                            rootId: ROOM_ID,
                            nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }],
                        },
                    },
                ],
                emitFinding,
            }
        )

        expect(result.emittedCount).toBe(2)
        expect(result.ephemeraIds).toEqual([CHARACTER_HOST, ROOM_ID].sort())
        expect(emitFinding).toHaveBeenCalledTimes(2)
    })

    it('throws without EVENT_BUS_NAME', async () => {
        delete process.env.EVENT_BUS_NAME
        await expect(ludicGraphStaleStructureSweep({}, { listCandidateRows: async () => [], emitFinding }))
            .rejects.toThrow('EVENT_BUS_NAME')
    })
})
