// Copyright 2026 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

jest.mock('./queryMetaSessionsForPlayer', () => ({
    queryMetaSessionRowsForPlayer: jest.fn()
}))
jest.mock('../staleSessionTeardown', () => ({
    tearDownStaleSession: jest.fn().mockImplementation(async () => {})
}))

import { queryMetaSessionRowsForPlayer } from './queryMetaSessionsForPlayer'
import { tearDownStaleSession } from '../staleSessionTeardown'
import { handleStaleSessionFinding } from './index'
import { STALE_BUFFER_MS } from './classification'

const queryMock = jest.mocked(queryMetaSessionRowsForPlayer)
const tearDownMock = jest.mocked(tearDownStaleSession)

describe('handleStaleSessionFinding', () => {
    let logSpy: jest.SpiedFunction<typeof console.log>

    beforeEach(() => {
        jest.clearAllMocks()
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
        process.env.TABLE_PREFIX = 'test-prefix'
        process.env.AWS_REGION = 'us-east-1'
    })

    afterEach(() => {
        logSpy.mockRestore()
    })

    it('skips when player is missing or blank and logs', async () => {
        await handleStaleSessionFinding({})
        await handleStaleSessionFinding({ player: '' })
        await handleStaleSessionFinding({ player: '   ' })

        expect(queryMock).not.toHaveBeenCalled()
        expect(tearDownMock).not.toHaveBeenCalled()
        const payloads = logSpy.mock.calls.map(([line]) => JSON.parse(line as string))
        expect(payloads.filter((p) => p.event === 'stale-session-finding-skipped')).toHaveLength(3)
    })

    it('does not call teardown when no rows match the player', async () => {
        queryMock.mockResolvedValue([])

        await handleStaleSessionFinding({ player: 'p1' })

        expect(tearDownMock).not.toHaveBeenCalled()
    })

    it('does not call teardown when meta row is no longer stale (idempotency)', async () => {
        const nowMs = Date.now()
        const dropAfter = nowMs + 5_000
        queryMock.mockResolvedValue([{
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#s1',
            connections: [],
            dropAfter,
            player: 'p1'
        }])

        await handleStaleSessionFinding({ player: 'p1' })

        expect(tearDownMock).not.toHaveBeenCalled()
    })

    it('invokes tearDown for matching player when row is stale', async () => {
        const nowMs = Date.now()
        const dropAfter = nowMs - 50_000
        queryMock.mockResolvedValue([{
            ConnectionId: 'Meta::Session',
            DataCategory: 'SESSION#sess-1',
            connections: [],
            dropAfter,
            player: 'p1'
        }])

        await handleStaleSessionFinding({ player: 'p1' })

        expect(tearDownMock).toHaveBeenCalledTimes(1)
        expect(tearDownMock).toHaveBeenCalledWith('sess-1', {
            sourceOperation: 'staleSessionFinding',
            player: 'p1'
        })
    })

    it('processes multiple stale sessions serially', async () => {
        const nowMs = Date.now()
        const dropAfter = nowMs - STALE_BUFFER_MS - 1000
        queryMock.mockResolvedValue([
            {
                ConnectionId: 'Meta::Session',
                DataCategory: 'SESSION#a',
                connections: [],
                dropAfter,
                player: 'p1'
            },
            {
                ConnectionId: 'Meta::Session',
                DataCategory: 'SESSION#b',
                connections: [],
                dropAfter,
                player: 'p1'
            }
        ])

        await handleStaleSessionFinding({ player: 'p1' })

        expect(tearDownMock).toHaveBeenCalledTimes(2)
        expect(tearDownMock.mock.calls[0][0]).toBe('a')
        expect(tearDownMock.mock.calls[1][0]).toBe('b')
    })
})
