import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { marshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    connectionDB: {
        query: jest.fn()
    },
    META_SESSION_PK: 'Meta::Session',
    sessionIdFromMetaSortKey: (dc: string) => (dc.startsWith('SESSION#') ? dc.slice(8) : undefined),
    sessionMetaSortKey: (id: string) => `SESSION#${id}`
}))

import { connectionDB, META_SESSION_PK } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { roomOccupancyDriftSweep } from './index'

describe('roomOccupancyDriftSweep', () => {
    const ddSend = jest.spyOn(DynamoDBClient.prototype, 'send') as jest.Mock
    const ebSend = jest.spyOn(EventBridgeClient.prototype, 'send') as jest.Mock

    beforeEach(() => {
        ddSend.mockReset()
        ebSend.mockReset()
        jest.mocked(connectionDB.query).mockReset()
        jest.mocked(connectionDB.query).mockResolvedValue([])
        process.env.TABLE_PREFIX = 'test-prefix'
        process.env.EVENT_BUS_NAME = 'test-bus'
        process.env.AWS_REGION = 'us-east-1'
    })

    it('emits one finding for a room with mixed valid and invalid occupancy entries', async () => {
        ddSend
            .mockResolvedValueOnce({
                Items: [
                    marshall({
                        ConnectionId: META_SESSION_PK,
                        DataCategory: 'SESSION#sess-1'
                    }),
                    marshall({
                        ConnectionId: META_SESSION_PK,
                        DataCategory: 'SESSION#sess-2'
                    })
                ]
            } as never)
            .mockResolvedValueOnce({
                Items: [
                    marshall({
                        EphemeraId: 'CHARACTER#one',
                        RoomId: 'alpha'
                    }),
                    marshall({
                        EphemeraId: 'CHARACTER#two',
                        RoomId: ''
                    })
                ]
            } as never)
            .mockResolvedValueOnce({
                Items: [
                    marshall({
                        EphemeraId: 'ROOM#alpha',
                        activeCharacters: [
                            { EphemeraId: 'CHARACTER#one', SessionIds: ['sess-1'] },
                            { EphemeraId: 'CHARACTER#two', SessionIds: ['sess-2'] }
                        ]
                    })
                ]
            } as never)
        jest.mocked(connectionDB.query)
            .mockResolvedValueOnce([{ DataCategory: 'CHARACTER#one' }] as never)
            .mockResolvedValueOnce([{ DataCategory: 'CHARACTER#two' }] as never)
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
        ddSend
            .mockResolvedValueOnce({
                Items: [
                    marshall({
                        ConnectionId: META_SESSION_PK,
                        DataCategory: 'SESSION#sess-1'
                    })
                ]
            } as never)
            .mockResolvedValueOnce({
                Items: [
                    marshall({
                        EphemeraId: 'CHARACTER#one',
                        RoomId: 'ROOM#alpha'
                    })
                ]
            } as never)
            .mockResolvedValueOnce({
                Items: [
                    marshall({
                        EphemeraId: 'ROOM#alpha',
                        activeCharacters: [
                            { EphemeraId: 'CHARACTER#one', SessionIds: ['sess-1'] }
                        ]
                    })
                ]
            } as never)
        jest.mocked(connectionDB.query)
            .mockResolvedValueOnce([{ DataCategory: 'CHARACTER#one' }] as never)

        const result = await roomOccupancyDriftSweep({
            diagnosticRunId: 'run-room-2',
            nowMs: 1000
        })

        expect(result.emittedCount).toBe(0)
        expect(result.roomIds).toEqual([])
        expect(ebSend).not.toHaveBeenCalled()
    })
})

