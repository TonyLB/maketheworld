import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'

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

    it('emits one finding for a room with mixed valid and invalid occupancy entries', async () => {
        connectionQueryMock
            .mockImplementationOnce(async () => ({
                items: [
                    { DataCategory: 'SESSION#sess-1' },
                    { DataCategory: 'SESSION#sess-2' }
                ]
            }))
            .mockImplementationOnce(async () => ([{ DataCategory: 'CHARACTER#one' }]))
            .mockImplementationOnce(async () => ([{ DataCategory: 'CHARACTER#two' }]))
        ephemeraQueryMock
            .mockImplementationOnce(async () => ({
                items: [
                    { EphemeraId: 'CHARACTER#one', RoomId: 'alpha' },
                    { EphemeraId: 'CHARACTER#two', RoomId: '' }
                ]
            }))
            .mockImplementationOnce(async () => ({
                items: [
                    {
                        EphemeraId: 'ROOM#alpha',
                        activeCharacters: [
                            { EphemeraId: 'CHARACTER#one', SessionIds: ['sess-1'] },
                            { EphemeraId: 'CHARACTER#two', SessionIds: ['sess-2'] }
                        ]
                    }
                ]
            }))
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await roomOccupancyDriftSweep({
            diagnosticRunId: 'run-room-1',
            nowMs: 500
        })

        expect(result.emittedCount).toBe(1)
        expect(result.roomIds).toEqual(['ROOM#alpha'])
        expect(result.checkLocationCandidates).toEqual(['ROOM#alpha'])
        expect(ebSend).toHaveBeenCalledTimes(1)
    })

    it('does not emit when occupancy matches adjacency and authoritative room assignment', async () => {
        connectionQueryMock
            .mockImplementationOnce(async () => ({
                items: [{ DataCategory: 'SESSION#sess-1' }]
            }))
            .mockImplementationOnce(async () => ([{ DataCategory: 'CHARACTER#one' }]))
        ephemeraQueryMock
            .mockImplementationOnce(async () => ({
                items: [{ EphemeraId: 'CHARACTER#one', RoomId: 'ROOM#alpha' }]
            }))
            .mockImplementationOnce(async () => ({
                items: [{
                    EphemeraId: 'ROOM#alpha',
                    activeCharacters: [
                        { EphemeraId: 'CHARACTER#one', SessionIds: ['sess-1'] }
                    ]
                }]
            }))

        const result = await roomOccupancyDriftSweep({
            diagnosticRunId: 'run-room-2',
            nowMs: 1000
        })

        expect(result.emittedCount).toBe(0)
        expect(result.roomIds).toEqual([])
        expect(ebSend).not.toHaveBeenCalled()
    })
})

