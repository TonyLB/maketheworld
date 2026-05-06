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

const transactionCanceled = () => {
    const err = new Error('Transaction canceled') as Error & { name?: string }
    err.name = 'TransactionCanceledException'
    return err
}

describe('tearDownStaleSession', () => {
    let logSpy: jest.SpiedFunction<typeof console.log>

    beforeEach(() => {
        jest.clearAllMocks()
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        connectionDBMock.query.mockResolvedValue([])
        eventBridgeClientMock.send.mockResolvedValue(undefined as never)
    })

    afterEach(() => {
        logSpy.mockRestore()
    })

    it('after successful bookkeeping deletes Meta::Session row and emits Session Disconnect only', async () => {
        connectionDBMock.transactWrite.mockResolvedValue(undefined as never)

        await tearDownStaleSession('session-1', { sourceOperation: 'checkSession', player: 'p1' })

        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
        expect(eventBridgeClientMock.send.mock.calls[0][0]).toEqual([{
            DetailType: 'Session Disconnect',
            Detail: { sessionId: 'session-1' }
        }])
        expect(connectionDBMock.deleteItem).toHaveBeenCalledWith({
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#session-1'
        })
    })

    it('on bookkeeping failure for checkSession emits Session Disconnect Problem', async () => {
        jest.useFakeTimers()
        connectionDBMock.transactWrite.mockRejectedValue(transactionCanceled())

        const run = tearDownStaleSession('session-1', { sourceOperation: 'checkSession', player: 'p1' })
        await jest.runAllTimersAsync()
        await run

        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(2)
        expect(eventBridgeClientMock.send.mock.calls[1][0][0].DetailType).toBe('Session Disconnect Problem')
        jest.useRealTimers()
    })

    it('on bookkeeping failure for staleSessionFinding does not emit Session Disconnect Problem', async () => {
        jest.useFakeTimers()
        connectionDBMock.transactWrite.mockRejectedValue(transactionCanceled())

        const run = tearDownStaleSession('session-1', { sourceOperation: 'staleSessionFinding', player: 'p1' })
        await jest.runAllTimersAsync()
        await run

        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
        expect(eventBridgeClientMock.send.mock.calls[0][0][0].DetailType).toBe('Session Disconnect')

        const logEvents = logSpy.mock.calls.map(([line]) => JSON.parse(line as string))
        expect(logEvents.some((e) => e.event === 'session-disconnect-bookkeeping-failed-suppressed')).toBe(true)
        expect(logEvents.some((e) => e.suppressedProblemReport === true)).toBe(true)

        jest.useRealTimers()
    })
})
