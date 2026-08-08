import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    connectionDB: {
        query: jest.fn(),
        getItem: jest.fn(),
        getItems: jest.fn(),
        putItem: jest.fn(),
        deleteItem: jest.fn()
    },
    assetDB: {
        query: jest.fn()
    },
    META_SESSION_PK: 'Meta::Session',
    sessionIdFromMetaSortKey: (dc: string) => (dc.startsWith('SESSION#') ? dc.slice(8) : undefined),
    sessionMetaSortKey: (id: string) => `SESSION#${id}`,
    playerSessionsPK: (player: string) => `PLAYER#${player}`
}))

import { assetDB, connectionDB, META_SESSION_PK } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { evaluateStaleSessionsForPlayer, staleSessionSweep } from './index'
import { STALE_BUFFER_MS } from './classification'

describe('staleSessionSweep', () => {
    const ebSend = jest.spyOn(EventBridgeClient.prototype, 'send') as jest.Mock
    const queryMock = connectionDB.query as unknown as jest.Mock
    const getItemMock = connectionDB.getItem as unknown as jest.Mock
    const getItemsMock = connectionDB.getItems as unknown as jest.Mock
    const putItemMock = connectionDB.putItem as unknown as jest.Mock
    const deleteItemMock = connectionDB.deleteItem as unknown as jest.Mock
    const assetQueryMock = assetDB.query as unknown as jest.Mock

    beforeEach(() => {
        ebSend.mockReset()
        queryMock.mockReset()
        getItemMock.mockReset()
        getItemsMock.mockReset()
        putItemMock.mockReset()
        deleteItemMock.mockReset()
        assetQueryMock.mockReset()
        queryMock.mockImplementation(async (props: any) => (
            props?.pagination ? { items: [] } : []
        ))
        getItemMock.mockResolvedValue(undefined)
        putItemMock.mockResolvedValue({})
        deleteItemMock.mockResolvedValue({})
        assetQueryMock.mockImplementation(async (props: any) => (
            props?.pagination ? { items: [] } : []
        ))
        process.env.EVENT_BUS_NAME = 'test-bus'
        process.env.AWS_REGION = 'us-east-1'
    })

    it('emits one finding per affected player when meta is past grace', async () => {
        const dropAfter = 1000
        const nowMs = dropAfter + STALE_BUFFER_MS + 50
        queryMock.mockImplementationOnce(async () => ({
            items: [{
                    ConnectionId: META_SESSION_PK,
                    DataCategory: 'SESSION#sess-a',
                    connections: [],
                    dropAfter,
                    player: 'player-one'
            }]
        }))
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await staleSessionSweep({ diagnosticRunId: 'run-test', nowMs })

        expect(result.players).toEqual(['player-one'])
        expect(result.emittedCount).toBe(1)
        expect(ebSend).toHaveBeenCalledTimes(1)
    })

    it('does not emit when still inside diagnostics buffer after dropAfter', async () => {
        const dropAfter = 50_000
        const nowMs = dropAfter + STALE_BUFFER_MS - 10
        queryMock.mockImplementationOnce(async () => ({
            items: [{
                    ConnectionId: META_SESSION_PK,
                    DataCategory: 'SESSION#sess-b',
                    connections: [],
                    dropAfter,
                    player: 'player-two'
            }]
        }))

        const result = await staleSessionSweep({ nowMs })

        expect(result.emittedCount).toBe(0)
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('skips rows without a usable player name', async () => {
        const dropAfter = 1
        const nowMs = dropAfter + STALE_BUFFER_MS + 1
        queryMock.mockImplementationOnce(async () => ({
            items: [{
                    ConnectionId: META_SESSION_PK,
                    DataCategory: 'SESSION#sess-c',
                    connections: [],
                    dropAfter,
                    player: ''
            }]
        }))

        const result = await staleSessionSweep({ nowMs })

        expect(result.emittedCount).toBe(0)
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('produces the same player set on repeated runs with identical inputs', async () => {
        const dropAfter = 100
        const nowMs = dropAfter + STALE_BUFFER_MS + 100
        const metaItem = {
            ConnectionId: META_SESSION_PK,
            DataCategory: 'SESSION#sess-d',
            connections: [],
            dropAfter,
            player: 'repeat-player'
        }

        queryMock.mockImplementation(async (props: any) => (
            props?.pagination ? { items: [metaItem] } : []
        ))
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const first = await staleSessionSweep({ diagnosticRunId: 'same', nowMs })
        const second = await staleSessionSweep({ diagnosticRunId: 'same', nowMs })

        expect(first.players).toEqual(second.players)
        expect(first.players).toEqual(['repeat-player'])
        expect(ebSend).toHaveBeenCalledTimes(2)
    })

    it('iterates paginated query results via nextPage callback', async () => {
        const dropAfter = 1000
        const nowMs = dropAfter + STALE_BUFFER_MS + 10
        const secondPage = jest.fn<() => Promise<any>>().mockResolvedValue({
            items: [{
                ConnectionId: META_SESSION_PK,
                DataCategory: 'SESSION#sess-f',
                connections: [],
                dropAfter,
                player: 'player-two'
            }]
        })
        queryMock.mockImplementationOnce(async () => ({
            items: [{
                ConnectionId: META_SESSION_PK,
                DataCategory: 'SESSION#sess-e',
                connections: [],
                dropAfter,
                player: 'player-one'
            }],
            nextPage: secondPage
        }))
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await staleSessionSweep({ nowMs })

        expect(secondPage).toHaveBeenCalledTimes(1)
        expect(result.players).toEqual(['player-one', 'player-two'])
        expect(result.emittedCount).toBe(2)
    })

    it('backfills a pointer for a meta row with a player and no existing pointer', async () => {
        queryMock.mockImplementationOnce(async () => ({
            items: [{
                ConnectionId: META_SESSION_PK,
                DataCategory: 'SESSION#sess-g',
                connections: ['conn-1'],
                player: 'player-g'
            }]
        }))
        getItemMock.mockResolvedValue(undefined)

        await staleSessionSweep({ nowMs: 0 })

        expect(getItemMock).toHaveBeenCalledWith(expect.objectContaining({
            Key: { ConnectionId: 'PLAYER#player-g', DataCategory: 'SESSION#sess-g' }
        }))
        expect(putItemMock).toHaveBeenCalledWith({
            ConnectionId: 'PLAYER#player-g',
            DataCategory: 'SESSION#sess-g'
        })
    })

    it('does not backfill a pointer that already exists', async () => {
        queryMock.mockImplementationOnce(async () => ({
            items: [{
                ConnectionId: META_SESSION_PK,
                DataCategory: 'SESSION#sess-h',
                connections: ['conn-1'],
                player: 'player-h'
            }]
        }))
        getItemMock.mockResolvedValue({ ConnectionId: 'PLAYER#player-h' })

        await staleSessionSweep({ nowMs: 0 })

        expect(putItemMock).not.toHaveBeenCalled()
    })

    it('prunes a pointer whose session has no matching meta row', async () => {
        // No meta rows this run (first pagination call returns empty).
        assetQueryMock.mockImplementationOnce(async () => ({
            items: [{ AssetId: 'PLAYER#player-i', DataCategory: 'Meta::Player' }]
        }))
        queryMock.mockImplementation(async (props: any) => {
            if (props?.pagination) {
                return { items: [] }
            }
            if (props?.Key?.ConnectionId === 'PLAYER#player-i') {
                return [{ DataCategory: 'SESSION#dangling-session' }]
            }
            return []
        })

        await staleSessionSweep({ nowMs: 0 })

        expect(deleteItemMock).toHaveBeenCalledWith({
            ConnectionId: 'PLAYER#player-i',
            DataCategory: 'SESSION#dangling-session'
        })
    })

    it('does not prune a pointer whose session still has a meta row', async () => {
        queryMock.mockImplementation(async (props: any) => {
            if (props?.pagination) {
                return { items: [{
                    ConnectionId: META_SESSION_PK,
                    DataCategory: 'SESSION#live-session',
                    connections: ['conn-1'],
                    player: 'player-j'
                }] }
            }
            if (props?.Key?.ConnectionId === 'PLAYER#player-j') {
                return [{ DataCategory: 'SESSION#live-session' }]
            }
            return []
        })
        getItemMock.mockResolvedValue({ ConnectionId: 'PLAYER#player-j' })
        assetQueryMock.mockImplementationOnce(async () => ({
            items: [{ AssetId: 'PLAYER#player-j', DataCategory: 'Meta::Player' }]
        }))

        await staleSessionSweep({ nowMs: 0 })

        expect(deleteItemMock).not.toHaveBeenCalled()
    })
})

describe('evaluateStaleSessionsForPlayer', () => {
    const ebSend = jest.spyOn(EventBridgeClient.prototype, 'send') as jest.Mock
    const queryMock = connectionDB.query as unknown as jest.Mock
    const getItemsMock = connectionDB.getItems as unknown as jest.Mock

    beforeEach(() => {
        ebSend.mockReset()
        queryMock.mockReset()
        getItemsMock.mockReset()
        process.env.EVENT_BUS_NAME = 'test-bus'
        process.env.AWS_REGION = 'us-east-1'
    })

    it('emits a finding for the scoped player when a pointed-to session is past the buffer', async () => {
        const dropAfter = 1000
        const nowMs = dropAfter + STALE_BUFFER_MS + 50
        queryMock.mockResolvedValue([{ ConnectionId: 'PLAYER#player-one', DataCategory: 'SESSION#sess-a' }])
        getItemsMock.mockResolvedValue([{
            ConnectionId: META_SESSION_PK,
            DataCategory: 'SESSION#sess-a',
            connections: [],
            dropAfter
        }])
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await evaluateStaleSessionsForPlayer({ player: 'player-one', diagnosticRunId: 'run-test', nowMs })

        expect(result).toEqual({ emittedCount: 1, players: ['player-one'] })
        expect(ebSend).toHaveBeenCalledTimes(1)
        expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
            Key: { ConnectionId: 'PLAYER#player-one' },
            ConsistentRead: true
        }))
    })

    it('emits nothing for a session still inside its grace window', async () => {
        const dropAfter = 50_000
        const nowMs = dropAfter + STALE_BUFFER_MS - 10
        queryMock.mockResolvedValue([{ ConnectionId: 'PLAYER#player-two', DataCategory: 'SESSION#sess-b' }])
        getItemsMock.mockResolvedValue([{
            ConnectionId: META_SESSION_PK,
            DataCategory: 'SESSION#sess-b',
            connections: [],
            dropAfter
        }])

        const result = await evaluateStaleSessionsForPlayer({ player: 'player-two', nowMs })

        expect(result).toEqual({ emittedCount: 0, players: [] })
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('emits nothing when the player has no pointers', async () => {
        queryMock.mockResolvedValue([])

        const result = await evaluateStaleSessionsForPlayer({ player: 'player-three', nowMs: 0 })

        expect(result).toEqual({ emittedCount: 0, players: [] })
        expect(getItemsMock).not.toHaveBeenCalled()
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('does not touch any other player -- only queries the scoped player pointer partition', async () => {
        queryMock.mockResolvedValue([])

        await evaluateStaleSessionsForPlayer({ player: 'player-four', nowMs: 0 })

        expect(queryMock).toHaveBeenCalledTimes(1)
        expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
            Key: { ConnectionId: 'PLAYER#player-four' }
        }))
    })
})
