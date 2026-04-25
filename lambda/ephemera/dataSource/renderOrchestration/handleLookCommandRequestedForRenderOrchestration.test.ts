import type { MessageBus } from '../../messageBus/baseClasses'
import * as perceptionSub from '../perception/subscribedEvents'
import * as roSub from './subscribedEvents'
import internalCache from '../../internalCache'
import { resolveCanonAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import {
    handleLookCommandRequestedForRenderOrchestration,
    prepareLookOrchestrationPerspective,
} from './handleLookCommandRequestedForRenderOrchestration'

jest.mock('../../internalCache')
jest.mock('../state/resolveAssetStackForRoom', () => ({
    resolveCanonAssetStackForRoom: jest.fn(),
}))
jest.mock('./fanOutStateChangedToPassiveRenders', () => ({
    filterRoomCanonStackByCharacterAssets: jest.fn(),
}))

const internalCacheMock = jest.mocked(internalCache, true as any)
const mockResolveCanonAssetStackForRoom = resolveCanonAssetStackForRoom as jest.MockedFunction<typeof resolveCanonAssetStackForRoom>
const mockFilterRoomCanonStackByCharacterAssets = filterRoomCanonStackByCharacterAssets as jest.MockedFunction<typeof filterRoomCanonStackByCharacterAssets>

describe('handleLookCommandRequestedForRenderOrchestration', () => {
    const send = jest.fn()
    const flush = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined)
    const bus = { send, flush } as unknown as MessageBus

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveCanonAssetStackForRoom.mockResolvedValue(['ASSET#A', 'ASSET#B'])
        internalCacheMock.CharacterMeta = {
            get: jest.fn().mockResolvedValue({ assets: ['ASSET#B'] }),
        } as unknown as typeof internalCacheMock.CharacterMeta
        mockFilterRoomCanonStackByCharacterAssets.mockReturnValue(['ASSET#A'])
    })

    it('prepareLookOrchestrationPerspective derives filtered perspective and perspectiveKey', async () => {
        const result = await prepareLookOrchestrationPerspective('CHARACTER#C', 'ROOM#X')

        expect(mockResolveCanonAssetStackForRoom).toHaveBeenCalledWith('ROOM#X', {
            RoomAssets: internalCacheMock.RoomAssets,
            AssetMetaData: internalCacheMock.AssetMetaData,
        })
        expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#C')
        expect(mockFilterRoomCanonStackByCharacterAssets).toHaveBeenCalledWith(
            ['ASSET#A', 'ASSET#B'],
            ['ASSET#B']
        )
        expect(result.roomId).toBe('ROOM#X')
        expect(result.perspective).toEqual({ assetStack: ['ASSET#A'] })
        expect(result.perspectiveKey).toEqual(expect.any(String))
        expect(result.perspectiveKey.length).toBeGreaterThan(0)
    })

    it('flushes only the perception lane, then sendRenderRequested with useDefaultMessageBusLane', async () => {
        const spt = jest.spyOn(perceptionSub, 'sendPerceptionThreadRegistered').mockImplementation(() => {})
        const srr = jest.spyOn(roSub, 'sendRenderRequested').mockImplementation(() => {})

        await handleLookCommandRequestedForRenderOrchestration(bus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            roomId: 'ROOM#X',
            confidence: 1,
        })

        expect(flush).toHaveBeenCalledTimes(1)
        const flushedLane = flush.mock.calls[0][0]
        expect(typeof flushedLane).toBe('string')
        expect(flushedLane).not.toHaveLength(0)
        expect(flushedLane).toMatch(/^lookCommand:perceptionThread:/)
        expect(flush.mock.calls.map((c) => c[0]).join(';')).not.toMatch(/renderOrchestration:/)
        expect(spt).toHaveBeenCalledWith(
            bus,
            'ROOM#X',
            expect.objectContaining({ threadKind: 'roomDescription' }),
            flushedLane
        )
        expect(srr).toHaveBeenCalledWith(
            bus,
            'ROOM#X',
            expect.objectContaining({ componentId: 'ROOM#X' }),
            { useDefaultMessageBusLane: true }
        )
        const renderCommand = srr.mock.calls[0][2] as Record<string, unknown>
        expect(renderCommand.generationContextWml).toBeUndefined()

        spt.mockRestore()
        srr.mockRestore()
    })
})
