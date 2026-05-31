import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { sendAffordanceRefreshRequestedForRoom } from './sendAffordanceRefreshRequestedForRoom'
import * as subscribedEvents from './subscribedEvents'

const A = 'ASSET#a' as AssetUUID
const B = 'ASSET#b' as AssetUUID
const C = 'ASSET#c' as AssetUUID
const roomId = 'ROOM#affSend' as EphemeraRoomId

describe('sendAffordanceRefreshRequestedForRoom', () => {
    const baseDeps = () => ({
        resolveRoomAssetStackForRoom: jest.fn().mockResolvedValue([C, A, B]),
        resolveCanonAssetStackForRoom: jest.fn().mockResolvedValue([A]),
        roomCharacterListGet: jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' },
            { EphemeraId: 'CHARACTER#2' },
        ]),
        characterMetaGet: jest.fn().mockImplementation(async (id: EphemeraCharacterId) => {
            if (id === 'CHARACTER#1') {
                return { assets: [B, A] }
            }
            return { assets: [A] }
        }),
    })

    it('sendAffordancesRequested once per distinct perspective with correct reason', async () => {
        const sendSpy = jest.spyOn(subscribedEvents, 'sendAffordancesRequested').mockImplementation(() => {})
        const messageBus = { send: jest.fn() } as any

        await sendAffordanceRefreshRequestedForRoom({
            roomId,
            reason: 'roster',
            messageBus,
            useDefaultMessageBusLane: true,
            deps: baseDeps(),
        })

        expect(sendSpy).toHaveBeenCalledTimes(2)
        for (const call of sendSpy.mock.calls) {
            expect(call[1]).toBe(roomId)
            expect(call[2]).toMatchObject({ roomId, reason: 'roster' })
            expect(call[3]).toEqual({ useDefaultMessageBusLane: true })
        }
        const perspectiveKeys = sendSpy.mock.calls.map((c) =>
            computePerspectiveKey(c[2].perspective.assetStack)
        )
        expect(new Set(perspectiveKeys).size).toBe(2)
        sendSpy.mockRestore()
    })

    it('does not call sendAffordancesRequested when room has no occupants', async () => {
        const sendSpy = jest.spyOn(subscribedEvents, 'sendAffordancesRequested').mockImplementation(() => {})

        await sendAffordanceRefreshRequestedForRoom({
            roomId,
            reason: 'objects',
            messageBus: { send: jest.fn() } as any,
            deps: {
                ...baseDeps(),
                roomCharacterListGet: jest.fn().mockResolvedValue([]),
            },
        })

        expect(sendSpy).not.toHaveBeenCalled()
        sendSpy.mockRestore()
    })
})
