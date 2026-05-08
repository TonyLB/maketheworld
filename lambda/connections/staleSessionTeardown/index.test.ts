// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => {
    const actual = jest.requireActual('@tonylb/mtw-utilities/ts/dynamoDB') as typeof import('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            query: jest.fn(),
            transactWrite: jest.fn(),
            deleteItem: jest.fn()
        })
    }
})
jest.mock('@tonylb/mtw-utilities/ts/eventBridge')
jest.mock('../disconnect', () => ({
    atomicallyRemoveCharacterAdjacency: jest.fn().mockImplementation(async () => {})
}))

import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { tearDownStaleSession } from './index'

const connectionDBMock = jest.mocked(connectionDB)
const eventBridgeClientMock = jest.mocked(eventBridgeClient)
const queryMock = connectionDB.query as unknown as jest.Mock

describe('tearDownStaleSession', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        queryMock.mockImplementation(async () => ([]))
        eventBridgeClientMock.send.mockResolvedValue(undefined as never)
    })

    it('deletes Meta::Session row and emits Session Disconnect', async () => {
        await tearDownStaleSession('session-1', { sourceOperation: 'checkSession', player: 'p1' })

        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1', characterIds: [] }
        }])
        expect(connectionDBMock.deleteItem).toHaveBeenCalledWith({
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#session-1'
        })
    })

    it('publishes Session Disconnect via streamEvent when provided', async () => {
        const streamEvent = jest.fn(async (_params: any) => undefined)
        await tearDownStaleSession('session-2', {
            sourceOperation: 'checkSession',
            player: 'p2',
            streamEvent
        })

        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            streamKey: 'global',
            header: {
                type: 'Session Disconnect'
            },
            update: expect.objectContaining({
                type: 'Session Disconnect',
                sessionId: 'session-2',
                characterIds: []
            })
        }))
        expect(eventBridgeClientMock.send).not.toHaveBeenCalled()
    })
})
