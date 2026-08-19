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

    it('emits one finding when a room has a ghost on graph (no sessions)', async () => {
        ephemeraQueryMock
            .mockImplementationOnce(async () => ({
                items: [{
                    EphemeraId: roomAlpha,
                    ludicGraph: { rootId: roomAlpha, nodes: [graphNode(characterGhost)] },
                }],
            }))
            .mockImplementation(async (props: any) => {
                if (props?.Key?.EphemeraId === characterGhost) {
                    return []
                }
                return []
            })
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await roomOccupancyDriftSweep({
            diagnosticRunId: 'run-ghost',
            nowMs: 500,
        })

        expect(result.emittedCount).toBe(1)
        expect(result.roomIds).toEqual([roomAlpha])
        expect(ebSend).toHaveBeenCalledTimes(1)
    })

    it('emits one finding when a live graph character is missing adjacency for the room', async () => {
        connectionQueryMock
            .mockImplementationOnce(async () => ({
                items: [{ DataCategory: 'SESSION#sess-1' }],
            }))
            .mockImplementationOnce(async () => ([{ DataCategory: characterOne }]))
        ephemeraQueryMock
            .mockImplementationOnce(async () => ({
                items: [{
                    EphemeraId: roomAlpha,
                    ludicGraph: { rootId: roomAlpha, nodes: [graphNode(characterOne)] },
                }],
            }))
            .mockImplementation(async (props: any) => {
                if (props?.Key?.EphemeraId === characterOne) {
                    return []
                }
                return []
            })
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await roomOccupancyDriftSweep({
            diagnosticRunId: 'run-adjacency-lag',
            nowMs: 600,
        })

        expect(result.emittedCount).toBe(1)
        expect(result.roomIds).toEqual([roomAlpha])
        expect(ebSend).toHaveBeenCalledTimes(1)
    })

    it('does not emit when graph, sessions, and membership adjacency align', async () => {
        connectionQueryMock
            .mockImplementationOnce(async () => ({
                items: [{ DataCategory: 'SESSION#sess-1' }],
            }))
            .mockImplementationOnce(async () => ([{ DataCategory: characterOne }]))
        ephemeraQueryMock
            .mockImplementationOnce(async () => ({
                items: [{
                    EphemeraId: roomAlpha,
                    ludicGraph: { rootId: roomAlpha, nodes: [graphNode(characterOne)] },
                }],
            }))
            .mockImplementation(async (props: any) => {
                if (props?.Key?.EphemeraId === characterOne) {
                    return [{
                        DataCategory: buildPositionAdjacencyDataCategory(roomAlpha),
                    }]
                }
                return []
            })

        const result = await roomOccupancyDriftSweep({
            diagnosticRunId: 'run-clean',
            nowMs: 1000,
        })

        expect(result.emittedCount).toBe(0)
        expect(result.roomIds).toEqual([])
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('explicit gap: empty graph does not emit even when orphan adjacency could exist elsewhere', async () => {
        ephemeraQueryMock.mockImplementationOnce(async () => ({
            items: [{
                EphemeraId: roomAlpha,
                ludicGraph: { rootId: roomAlpha, nodes: [] },
            }],
        }))

        const result = await roomOccupancyDriftSweep({
            diagnosticRunId: 'run-explicit-gap',
            nowMs: 1100,
        })

        expect(result.emittedCount).toBe(0)
        expect(result.roomIds).toEqual([])
        expect(ebSend).not.toHaveBeenCalled()
        expect(ephemeraQueryMock).toHaveBeenCalledTimes(1)
    })
})
