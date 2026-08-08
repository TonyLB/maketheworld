// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { queryMetaSessionRowsForPlayer } from './queryMetaSessionsForPlayer'

const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>

describe('queryMetaSessionRowsForPlayer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('queries the player pointer partition with a consistent read', async () => {
        connectionDBMock.query.mockResolvedValueOnce([] as any)

        await queryMetaSessionRowsForPlayer('Testy')

        expect(connectionDBMock.query).toHaveBeenCalledWith(expect.objectContaining({
            Key: { ConnectionId: 'PLAYER#Testy' },
            ConsistentRead: true
        }))
    })

    it('returns an empty array and skips the batch-get when there are no pointers', async () => {
        connectionDBMock.query.mockResolvedValueOnce([] as any)

        const result = await queryMetaSessionRowsForPlayer('Testy')

        expect(result).toEqual([])
        expect(connectionDBMock.getItems).not.toHaveBeenCalled()
    })

    it('batch-fetches meta rows for the resolved session ids', async () => {
        connectionDBMock.query.mockResolvedValueOnce([
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#s1' }
        ] as any)
        const metaRow = {
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#s1',
            connections: [],
            dropAfter: 12345,
            player: 'Testy'
        }
        connectionDBMock.getItems.mockResolvedValueOnce([metaRow] as any)

        const result = await queryMetaSessionRowsForPlayer('Testy')

        expect(connectionDBMock.getItems).toHaveBeenCalledWith(expect.objectContaining({
            Keys: [{ ConnectionId: 'Meta::Session', DataCategory: 'SESSION#s1' }],
            ConsistentRead: true
        }))
        expect(result).toEqual([metaRow])
    })

    it('dedupes repeated session pointers before the batch-get', async () => {
        connectionDBMock.query.mockResolvedValueOnce([
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#s1' },
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#s1' }
        ] as any)
        connectionDBMock.getItems.mockResolvedValueOnce([] as any)

        await queryMetaSessionRowsForPlayer('Testy')

        expect(connectionDBMock.getItems).toHaveBeenCalledWith(expect.objectContaining({
            Keys: [{ ConnectionId: 'Meta::Session', DataCategory: 'SESSION#s1' }]
        }))
    })

    it('omits pointers whose meta row is missing from the batch-get response', async () => {
        connectionDBMock.query.mockResolvedValueOnce([
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#s1' },
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#s2' }
        ] as any)
        const metaRow = {
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#s1',
            connections: [],
            player: 'Testy'
        }
        connectionDBMock.getItems.mockResolvedValueOnce([metaRow] as any)

        const result = await queryMetaSessionRowsForPlayer('Testy')

        expect(result).toEqual([metaRow])
    })
})
