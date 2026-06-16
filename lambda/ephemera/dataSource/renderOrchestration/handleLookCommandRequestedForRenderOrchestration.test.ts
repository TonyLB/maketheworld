import * as orchestrationHandler from './orchestrationHandler'
import internalCache from '../../internalCache'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import * as prepareFeatureKnowledge from './prepareFeatureKnowledgeRenderForCharacter'
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
jest.mock('./prepareFeatureKnowledgeRenderForCharacter', () => ({
    prepareFeatureKnowledgeRenderForCharacter: jest.fn(),
}))

const internalCacheMock = jest.mocked(internalCache, true as any)
const mockResolveCanonAssetStackForRoom = resolveCanonAssetStackForRoom as jest.MockedFunction<typeof resolveCanonAssetStackForRoom>
const mockResolveRoomAssetStackForRoom = resolveRoomAssetStackForRoom as jest.MockedFunction<typeof resolveRoomAssetStackForRoom>
const mockFilterRoomCanonStackByCharacterAssets = filterRoomCanonStackByCharacterAssets as jest.MockedFunction<typeof filterRoomCanonStackByCharacterAssets>
const mockOrchestrateRenderRequest = orchestrationHandler.orchestrateRenderRequest as jest.MockedFunction<typeof orchestrationHandler.orchestrateRenderRequest>
const mockPrepareFeatureKnowledgeRenderForCharacter = prepareFeatureKnowledge.prepareFeatureKnowledgeRenderForCharacter as jest.MockedFunction<typeof prepareFeatureKnowledge.prepareFeatureKnowledgeRenderForCharacter>

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

    it('registers roomDescription thread directly then calls orchestrateRenderRequest for room look', async () => {
        await handleLookCommandRequestedForRenderOrchestration({
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'ROOM#X',
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
        expect(mockPrepareFeatureKnowledgeRenderForCharacter).not.toHaveBeenCalled()
    })

    it('registers featureDescription and orchestrates for feature look', async () => {
        mockPrepareFeatureKnowledgeRenderForCharacter.mockResolvedValue({
            componentId: 'FEATURE#Door',
            characterId: 'CHARACTER#C',
            perspective: { assetStack: ['ASSET#A'] },
            perspectiveKey: 'pk-feature',
            threadRegisterCommand: {
                threadKind: 'featureDescription',
                componentId: 'FEATURE#Door',
                perspectiveKey: 'pk-feature',
                characterId: 'CHARACTER#C',
            },
            renderCommand: {
                componentId: 'FEATURE#Door',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                allowGeneration: false,
            },
        })

        await handleLookCommandRequestedForRenderOrchestration({
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'FEATURE#Door',
            confidence: 1,
        }, streamEvent)

        expect(mockPrepareFeatureKnowledgeRenderForCharacter).toHaveBeenCalledWith(
            'CHARACTER#C',
            'FEATURE#Door',
            undefined,
            { directResponse: undefined },
        )
        expect(internalCacheMock.PerceptionThreads.register).toHaveBeenCalledWith({
            threadKind: 'featureDescription',
            componentId: 'FEATURE#Door',
            perspectiveKey: 'pk-feature',
            characterId: 'CHARACTER#C',
        })
        expect(mockOrchestrateRenderRequest).toHaveBeenCalledWith({
            streamEvent,
            payload: {
                type: 'RenderRequested',
                componentId: 'FEATURE#Door',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                allowGeneration: false,
            },
        })
    })

    it('registers knowledgeDescription with directResponse for knowledge look', async () => {
        mockPrepareFeatureKnowledgeRenderForCharacter.mockResolvedValue({
            componentId: 'KNOWLEDGE#Lore',
            characterId: 'CHARACTER#C',
            perspective: { assetStack: ['ASSET#A'] },
            perspectiveKey: 'pk-knowledge',
            threadRegisterCommand: {
                threadKind: 'knowledgeDescription',
                componentId: 'KNOWLEDGE#Lore',
                perspectiveKey: 'pk-knowledge',
                characterId: 'CHARACTER#C',
                directResponse: true,
            },
            renderCommand: {
                componentId: 'KNOWLEDGE#Lore',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                allowGeneration: false,
            },
        })

        await handleLookCommandRequestedForRenderOrchestration({
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'KNOWLEDGE#Lore',
            confidence: 1,
            directResponse: true,
        }, streamEvent)

        expect(mockPrepareFeatureKnowledgeRenderForCharacter).toHaveBeenCalledWith(
            'CHARACTER#C',
            'KNOWLEDGE#Lore',
            undefined,
            { directResponse: true },
        )
        expect(internalCacheMock.PerceptionThreads.register).toHaveBeenCalledWith(
            expect.objectContaining({
                threadKind: 'knowledgeDescription',
                directResponse: true,
            })
        )
    })
})
