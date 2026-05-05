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
import { staleSessionSweep } from './index'
import { STALE_BUFFER_MS } from './classification'

describe('staleSessionSweep', () => {
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

    it('emits one finding per affected player when meta is past grace', async () => {
        const dropAfter = 1000
        const nowMs = dropAfter + STALE_BUFFER_MS + 50
        ddSend.mockResolvedValueOnce({
            Items: [
                marshall({
                    ConnectionId: META_SESSION_PK,
                    DataCategory: 'SESSION#sess-a',
                    connections: [],
                    dropAfter,
                    player: 'player-one'
                })
            ]
        } as never)
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await staleSessionSweep({ diagnosticRunId: 'run-test', nowMs })

        expect(result.players).toEqual(['player-one'])
        expect(result.emittedCount).toBe(1)
        expect(ebSend).toHaveBeenCalledTimes(1)
    })

    it('does not emit when still inside diagnostics buffer after dropAfter', async () => {
        const dropAfter = 50_000
        const nowMs = dropAfter + STALE_BUFFER_MS - 10
        ddSend.mockResolvedValueOnce({
            Items: [
                marshall({
                    ConnectionId: META_SESSION_PK,
                    DataCategory: 'SESSION#sess-b',
                    connections: [],
                    dropAfter,
                    player: 'player-two'
                })
            ]
        } as never)

        const result = await staleSessionSweep({ nowMs })

        expect(result.emittedCount).toBe(0)
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('skips rows without a usable player name', async () => {
        const dropAfter = 1
        const nowMs = dropAfter + STALE_BUFFER_MS + 1
        ddSend.mockResolvedValueOnce({
            Items: [
                marshall({
                    ConnectionId: META_SESSION_PK,
                    DataCategory: 'SESSION#sess-c',
                    connections: [],
                    dropAfter,
                    player: ''
                })
            ]
        } as never)

        const result = await staleSessionSweep({ nowMs })

        expect(result.emittedCount).toBe(0)
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('produces the same player set on repeated runs with identical inputs', async () => {
        const dropAfter = 100
        const nowMs = dropAfter + STALE_BUFFER_MS + 100
        const metaItem = marshall({
            ConnectionId: META_SESSION_PK,
            DataCategory: 'SESSION#sess-d',
            connections: [],
            dropAfter,
            player: 'repeat-player'
        })

        ddSend.mockResolvedValue({ Items: [metaItem] } as never)
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const first = await staleSessionSweep({ diagnosticRunId: 'same', nowMs })
        const second = await staleSessionSweep({ diagnosticRunId: 'same', nowMs })

        expect(first.players).toEqual(second.players)
        expect(first.players).toEqual(['repeat-player'])
        expect(ebSend).toHaveBeenCalledTimes(2)
    })
})
