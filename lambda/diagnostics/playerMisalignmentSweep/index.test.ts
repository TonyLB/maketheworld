import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        query: jest.fn()
    }
}))

import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { playerMisalignmentSweep } from './index'

describe('playerMisalignmentSweep', () => {
    const ebSend = jest.spyOn(EventBridgeClient.prototype, 'send') as jest.Mock
    const assetQueryMock = assetDB.query as unknown as jest.Mock

    beforeEach(() => {
        ebSend.mockReset()
        assetQueryMock.mockReset()
        process.env.EVENT_BUS_NAME = 'test-bus'
        process.env.AWS_REGION = 'us-east-1'
    })

    it('emits findings for players missing meta rows and missing guest fields', async () => {
        assetQueryMock
            .mockImplementationOnce(async () => ({
                items: [
                    { AssetId: 'PLAYER#alice', DataCategory: 'Meta::Player', guestName: '', guestId: 'guest-id' },
                    { AssetId: 'PLAYER#bob', DataCategory: 'Meta::Player', guestName: 'bob', guestId: 'guest-id-2' }
                ]
            }))
            .mockImplementationOnce(async () => ({
                items: [
                    { AssetId: 'ASSET#one', DataCategory: 'Meta::Asset', player: 'carol' }
                ]
            }))
            .mockImplementationOnce(async () => ({
                items: []
            }))
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await playerMisalignmentSweep({
            diagnosticRunId: 'run-player-1',
            nowMs: 1000
        })

        expect(result).toEqual({
            emittedCount: 2,
            players: ['alice', 'carol']
        })
        expect(ebSend).toHaveBeenCalledTimes(2)
    })

    it('returns empty result when all players are aligned', async () => {
        assetQueryMock
            .mockImplementationOnce(async () => ({
                items: [
                    { AssetId: 'PLAYER#alice', DataCategory: 'Meta::Player', guestName: 'alice', guestId: 'guest-id' }
                ]
            }))
            .mockImplementationOnce(async () => ({
                items: [
                    { AssetId: 'ASSET#one', DataCategory: 'Meta::Asset', player: 'alice' }
                ]
            }))
            .mockImplementationOnce(async () => ({
                items: [
                    { AssetId: 'CHARACTER#one', DataCategory: 'Meta::Character', player: 'alice' }
                ]
            }))

        const result = await playerMisalignmentSweep({
            diagnosticRunId: 'run-player-2',
            nowMs: 2000
        })

        expect(result).toEqual({
            emittedCount: 0,
            players: []
        })
        expect(ebSend).not.toHaveBeenCalled()
    })
})

