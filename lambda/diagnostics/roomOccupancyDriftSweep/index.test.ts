import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-gateways/ts/ephemera/positions'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    connectionDB: {
        query: jest.fn()
    },
    ephemeraDB: {
        query: jest.fn()
    },
    META_SESSION_PK: 'Meta::Session',
    sessionIdFromMetaSortKey: (dc: string) => (dc.startsWith('SESSION#') ? dc.slice(8) : undefined),
    sessionMetaSortKey: (id: string) => `SESSION#${id}`
}))

import { connectionDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { roomOccupancyDriftSweep } from './index'

const roomAlpha = 'ROOM#alpha' as const
const characterOne = 'CHARACTER#one' as const
const characterGhost = 'CHARACTER#ghost' as const

const graphNode = (universalKey: string) => ({
    tag: 'Character' as const,
    universalKey,
})

// Concepts clause 3 requires the graph's own root to be present in `nodes`.
const roomGraphNode = (universalKey: string) => ({
    tag: 'Room' as const,
    universalKey,
})

describe('roomOccupancyDriftSweep', () => {
    const ebSend = jest.spyOn(EventBridgeClient.prototype, 'send') as jest.Mock
    const connectionQueryMock = connectionDB.query as unknown as jest.Mock
    const ephemeraQueryMock = ephemeraDB.query as unknown as jest.Mock

    beforeEach(() => {
        ebSend.mockReset()
        connectionQueryMock.mockReset()
        ephemeraQueryMock.mockReset()
        connectionQueryMock.mockImplementation(async (props: any) => (
            props?.pagination ? { items: [] } : []
        ))
        ephemeraQueryMock.mockImplementation(async () => ({ items: [] }))
        process.env.TABLE_PREFIX = 'test-prefix'
        process.env.EVENT_BUS_NAME = 'test-bus'
        process.env.AWS_REGION = 'us-east-1'
    })

    /** Serves the sweep's three ephemera reads by what they ask for: the rooms, the characters rows, and a character's adjacency. */
    const serve = (args: {
        rooms?: { EphemeraId: string; ludicGraph?: unknown }[]
        rows?: Record<string, unknown>[]
        adjacencyByCharacter?: Record<string, string[]>
    }) => {
        ephemeraQueryMock.mockImplementation(async (props: any) => {
            if (props?.IndexName === 'DataCategoryIndex' && props.Key.DataCategory === 'Meta::Room') {
                return { items: args.rooms ?? [] }
            }
            if (props?.IndexName === 'DataCategoryIndex' && props.Key.DataCategory === 'LudicCache::Characters') {
                return { items: (args.rows ?? []).map((row) => ({ DataCategory: 'LudicCache::Characters', ...row })) }
            }
            return (args.adjacencyByCharacter?.[props?.Key?.EphemeraId] ?? []).map((roomId) => ({ DataCategory: buildPositionAdjacencyDataCategory(roomId as any) }))
        })
    }
    const aliveSession = () => connectionQueryMock
        .mockImplementationOnce(async () => ({ items: [{ DataCategory: 'SESSION#sess-1' }] }))
        .mockImplementationOnce(async () => ([{ DataCategory: characterOne }]))

    it('emits one finding when a room\'s row lists a ghost (no sessions)', async () => {
        serve({ rows: [{ EphemeraId: roomAlpha, [characterGhost]: ['PRESENCE#g1'] }] })
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await roomOccupancyDriftSweep({ diagnosticRunId: 'run-ghost', nowMs: 500 })

        expect(result.emittedCount).toBe(1)
        expect(result.roomIds).toEqual([roomAlpha])
        expect(ebSend).toHaveBeenCalledTimes(1)
    })

    it('emits one finding when a live row character is missing adjacency for the room', async () => {
        aliveSession()
        serve({ rows: [{ EphemeraId: roomAlpha, [characterOne]: ['PRESENCE#a1'] }] })
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await roomOccupancyDriftSweep({ diagnosticRunId: 'run-adjacency-lag', nowMs: 600 })

        expect(result.emittedCount).toBe(1)
        expect(result.roomIds).toEqual([roomAlpha])
    })

    it('emits one finding for a room whose stored graph still names a character (to migrate), though all else aligns', async () => {
        aliveSession()
        serve({
            rooms: [{ EphemeraId: roomAlpha, ludicGraph: { rootId: roomAlpha, ports: [], nodes: [roomGraphNode(roomAlpha), graphNode(characterOne)] } }],
            rows: [{ EphemeraId: roomAlpha, [characterOne]: ['PRESENCE#a1'] }],
            adjacencyByCharacter: { [characterOne]: [roomAlpha] },
        })
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await roomOccupancyDriftSweep({ diagnosticRunId: 'run-legacy', nowMs: 700 })

        expect(result.roomIds).toEqual([roomAlpha])
    })

    it('does not emit when the row, sessions, and membership adjacency align and the graph names nobody', async () => {
        aliveSession()
        serve({
            rooms: [{ EphemeraId: roomAlpha, ludicGraph: { rootId: roomAlpha, ports: [], nodes: [roomGraphNode(roomAlpha)] } }],
            rows: [{ EphemeraId: roomAlpha, [characterOne]: ['PRESENCE#a1'] }],
            adjacencyByCharacter: { [characterOne]: [roomAlpha] },
        })

        const result = await roomOccupancyDriftSweep({ diagnosticRunId: 'run-clean', nowMs: 1000 })

        expect(result.emittedCount).toBe(0)
        expect(result.roomIds).toEqual([])
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('explicit gap: an empty row does not emit even when orphan adjacency could exist elsewhere', async () => {
        serve({ rows: [{ EphemeraId: roomAlpha }] })

        const result = await roomOccupancyDriftSweep({ diagnosticRunId: 'run-explicit-gap', nowMs: 1100 })

        expect(result.emittedCount).toBe(0)
        expect(result.roomIds).toEqual([])
        expect(ebSend).not.toHaveBeenCalled()
    })
})
