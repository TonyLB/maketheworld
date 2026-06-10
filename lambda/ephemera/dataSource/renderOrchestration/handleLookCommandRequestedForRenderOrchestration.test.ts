import * as orchestrationHandler from './orchestrationHandler'
import internalCache from '../../internalCache'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import {
    handleLookCommandRequestedForRenderOrchestration,
    prepareLookOrchestrationPerspective,
} from './handleLookCommandRequestedForRenderOrchestration'

jest.mock('../../internalCache')
jest.mock('../state/resolveAssetStackForRoom', () => ({
    resolveCanonAssetStackForRoom: jest.fn(),
    resolveRoomAssetStackForRoom: jest.fn(),
}))
jest.mock('./fanOutStateChangedToPassiveRenders', () => ({
    filterRoomCanonStackByCharacterAssets: jest.fn(),
}))
jest.mock('./orchestrationHandler', () => ({
    orchestrateRenderRequest: jest.fn().mockResolvedValue(undefined),
}))

const internalCacheMock = jest.mocked(internalCache, true as any)
const mockResolveCanonAssetStackForRoom = resolveCanonAssetStackForRoom as jest.MockedFunction<typeof resolveCanonAssetStackForRoom>
const mockResolveRoomAssetStackForRoom = resolveRoomAssetStackForRoom as jest.MockedFunction<typeof resolveRoomAssetStackForRoom>
const mockFilterRoomCanonStackByCharacterAssets = filterRoomCanonStackByCharacterAssets as jest.MockedFunction<typeof filterRoomCanonStackByCharacterAssets>
const mockOrchestrateRenderRequest = orchestrationHandler.orchestrateRenderRequest as jest.MockedFunction<typeof orchestrationHandler.orchestrateRenderRequest>

describe('handleLookCommandRequestedForRenderOrchestration', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        internalCacheMock.PerceptionThreads = {
            register: jest.fn(),
        } as unknown as typeof internalCacheMock.PerceptionThreads
        mockResolveRoomAssetStackForRoom.mockResolvedValue(['ASSET#A', 'ASSET#B'])
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
        expect(mockResolveRoomAssetStackForRoom).toHaveBeenCalledWith('ROOM#X', {
            RoomAssets: internalCacheMock.RoomAssets,
        })
        expect(internalCacheMock.CharacterMeta.get).toHaveBeenCalledWith('CHARACTER#C')
        expect(mockFilterRoomCanonStackByCharacterAssets).toHaveBeenCalledWith(
            ['ASSET#A', 'ASSET#B'],
            ['ASSET#B'],
            ['ASSET#A', 'ASSET#B']
        )
        expect(result.roomId).toBe('ROOM#X')
        expect(result.perspective).toEqual({ assetStack: ['ASSET#A'] })
        expect(result.perspectiveKey).toEqual(expect.any(String))
        expect(result.perspectiveKey.length).toBeGreaterThan(0)
    })

    it('registers roomDescription thread directly then calls orchestrateRenderRequest', async () => {
        await handleLookCommandRequestedForRenderOrchestration({
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            roomId: 'ROOM#X',
            confidence: 1,
        }, streamEvent)

        expect(internalCacheMock.PerceptionThreads.register).toHaveBeenCalledWith(
            expect.objectContaining({
                threadKind: 'roomDescription',
                componentId: 'ROOM#X',
                characterId: 'CHARACTER#C',
            })
        )
        expect(mockOrchestrateRenderRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                streamEvent,
                payload: expect.objectContaining({
                    type: 'RenderRequested',
                    componentId: 'ROOM#X',
                    characterId: 'CHARACTER#C',
                }),
            })
        )
        const renderPayload = mockOrchestrateRenderRequest.mock.calls[0][0].payload as Record<string, unknown>
        expect(renderPayload.generationContextWml).toBeUndefined()
    })
})
