import * as orchestrationHandler from './orchestrationHandler'
import internalCache from '../../internalCache'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import * as prepareFeatureKnowledge from './prepareFeatureKnowledgeRenderForCharacter'
import * as prepareObject from './prepareObjectRenderForCharacter'
import { ensureObjectShortNameCacheRecord } from '../renderCache/ensureObjectShortNameCacheRecord'
import * as messageOrchestration from '../messageOrchestration'
import * as messageOrchestrationSubscribedEvents from '../messageOrchestration/subscribedEvents'
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
jest.mock('./prepareObjectRenderForCharacter', () => ({
    prepareObjectRenderForCharacter: jest.fn(),
}))
jest.mock('../renderCache/ensureObjectShortNameCacheRecord', () => ({
    ensureObjectShortNameCacheRecord: jest.fn(),
}))
jest.mock('../messageOrchestration', () => ({
    registerIngressSlot: jest.fn(),
}))
jest.mock('../messageOrchestration/subscribedEvents', () => ({
    sendMessageBundleDeclared: jest.fn(),
}))

const internalCacheMock = jest.mocked(internalCache, true as any)
const mockResolveCanonAssetStackForRoom = resolveCanonAssetStackForRoom as jest.MockedFunction<typeof resolveCanonAssetStackForRoom>
const mockResolveRoomAssetStackForRoom = resolveRoomAssetStackForRoom as jest.MockedFunction<typeof resolveRoomAssetStackForRoom>
const mockFilterRoomCanonStackByCharacterAssets = filterRoomCanonStackByCharacterAssets as jest.MockedFunction<typeof filterRoomCanonStackByCharacterAssets>
const mockOrchestrateRenderRequest = orchestrationHandler.orchestrateRenderRequest as jest.MockedFunction<typeof orchestrationHandler.orchestrateRenderRequest>
const mockPrepareFeatureKnowledgeRenderForCharacter = prepareFeatureKnowledge.prepareFeatureKnowledgeRenderForCharacter as jest.MockedFunction<typeof prepareFeatureKnowledge.prepareFeatureKnowledgeRenderForCharacter>
const mockPrepareObjectRenderForCharacter = prepareObject.prepareObjectRenderForCharacter as jest.MockedFunction<typeof prepareObject.prepareObjectRenderForCharacter>
const mockRegisterIngressSlot = messageOrchestration.registerIngressSlot as jest.MockedFunction<typeof messageOrchestration.registerIngressSlot>
const mockSendMessageBundleDeclared = messageOrchestrationSubscribedEvents.sendMessageBundleDeclared as jest.MockedFunction<typeof messageOrchestrationSubscribedEvents.sendMessageBundleDeclared>

describe('handleLookCommandRequestedForRenderOrchestration', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const messageBus = { publish: jest.fn() } as any

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveRoomAssetStackForRoom.mockResolvedValue(['ASSET#A', 'ASSET#B'])
        mockResolveCanonAssetStackForRoom.mockResolvedValue(['ASSET#A', 'ASSET#B'])
        internalCacheMock.CharacterMeta = {
            get: jest.fn().mockResolvedValue({ assets: ['ASSET#B'] }),
        } as unknown as typeof internalCacheMock.CharacterMeta
        internalCacheMock.Global = {
            get: jest.fn().mockResolvedValue('sess-123'),
        } as unknown as typeof internalCacheMock.Global
        mockFilterRoomCanonStackByCharacterAssets.mockReturnValue(['ASSET#A'])
        // registerIngressSlot's kickoff callback is what actually calls orchestrateRenderRequest
        // in production --- invoke it here so these tests can assert on orchestrateRenderRequest
        // without depending on messageOrchestration's own registration/kickoff mechanics
        // (covered by dataSource/messageOrchestration's own test suite).
        mockRegisterIngressSlot.mockImplementation(async (_bus, _bundleId, _spec, kickoff) => {
            await kickoff?.()
        })
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

    it('declares its own bundle, registers a room describe slot (format:full), and calls orchestrateRenderRequest for room look', async () => {
        await handleLookCommandRequestedForRenderOrchestration(messageBus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'ROOM#X',
            confidence: 1,
        }, streamEvent)

        expect(mockSendMessageBundleDeclared).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                slots: [expect.objectContaining({ slotId: expect.any(String), expectedPublishType: 'PerceptionMessage' })],
            })
        )
        expect(mockRegisterIngressSlot).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                componentId: 'ROOM#X',
                targets: ['CHARACTER#C'],
                contentStream: 'render',
                format: 'full',
            }),
            expect.any(Function)
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

    it('registers a feature describe slot (format:full) and orchestrates for feature look', async () => {
        mockPrepareFeatureKnowledgeRenderForCharacter.mockResolvedValue({
            componentId: 'FEATURE#Door',
            characterId: 'CHARACTER#C',
            perspective: { assetStack: ['ASSET#A'] },
            perspectiveKey: 'pk-feature',
            renderCommand: {
                componentId: 'FEATURE#Door',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                allowGeneration: false,
            },
        })

        await handleLookCommandRequestedForRenderOrchestration(messageBus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'FEATURE#Door',
            confidence: 1,
        }, streamEvent)

        expect(mockPrepareFeatureKnowledgeRenderForCharacter).toHaveBeenCalledWith('CHARACTER#C', 'FEATURE#Door')
        expect(mockRegisterIngressSlot).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                componentId: 'FEATURE#Door',
                perspectiveKey: 'pk-feature',
                targets: ['CHARACTER#C'],
                contentStream: 'render',
                format: 'full',
            }),
            expect.any(Function)
        )
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

    it('resolves SESSION# targets for a directResponse knowledge look', async () => {
        mockPrepareFeatureKnowledgeRenderForCharacter.mockResolvedValue({
            componentId: 'KNOWLEDGE#Lore',
            characterId: 'CHARACTER#C',
            perspective: { assetStack: ['ASSET#A'] },
            perspectiveKey: 'pk-knowledge',
            renderCommand: {
                componentId: 'KNOWLEDGE#Lore',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                allowGeneration: false,
            },
        })

        await handleLookCommandRequestedForRenderOrchestration(messageBus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'KNOWLEDGE#Lore',
            confidence: 1,
            directResponse: true,
        }, streamEvent)

        expect(internalCacheMock.Global.get).toHaveBeenCalledWith('SessionId')
        expect(mockRegisterIngressSlot).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                componentId: 'KNOWLEDGE#Lore',
                targets: ['SESSION#sess-123'],
            }),
            expect.any(Function)
        )
    })

    it('targets the character directly for a non-directResponse knowledge look', async () => {
        mockPrepareFeatureKnowledgeRenderForCharacter.mockResolvedValue({
            componentId: 'KNOWLEDGE#Lore',
            characterId: 'CHARACTER#C',
            perspective: { assetStack: ['ASSET#A'] },
            perspectiveKey: 'pk-knowledge',
            renderCommand: {
                componentId: 'KNOWLEDGE#Lore',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                allowGeneration: false,
            },
        })

        await handleLookCommandRequestedForRenderOrchestration(messageBus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'KNOWLEDGE#Lore',
            confidence: 1,
        }, streamEvent)

        expect(internalCacheMock.Global.get).not.toHaveBeenCalled()
        expect(mockRegisterIngressSlot).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                componentId: 'KNOWLEDGE#Lore',
                targets: ['CHARACTER#C'],
            }),
            expect.any(Function)
        )
    })

    it('registers an object describe slot and orchestrates with the ensureObjectShortNameCacheRecord override for object look (PK-6 stub)', async () => {
        mockPrepareObjectRenderForCharacter.mockResolvedValue({
            componentId: 'OBJECT#Tray',
            characterId: 'CHARACTER#C',
            perspective: { assetStack: ['ASSET#A'] },
            perspectiveKey: 'pk-object',
            renderCommand: {
                componentId: 'OBJECT#Tray',
                perspective: { assetStack: ['ASSET#A'] },
                characterId: 'CHARACTER#C',
                allowGeneration: false,
            },
        })

        await handleLookCommandRequestedForRenderOrchestration(messageBus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'OBJECT#Tray',
            confidence: 1,
        }, streamEvent)

        expect(mockPrepareObjectRenderForCharacter).toHaveBeenCalledWith('CHARACTER#C', 'OBJECT#Tray')
        expect(mockRegisterIngressSlot).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({
                componentId: 'OBJECT#Tray',
                perspectiveKey: 'pk-object',
                targets: ['CHARACTER#C'],
                contentStream: 'render',
                format: 'full',
            }),
            expect.any(Function)
        )
        expect(mockOrchestrateRenderRequest).toHaveBeenCalledWith(
            {
                streamEvent,
                payload: {
                    type: 'RenderRequested',
                    componentId: 'OBJECT#Tray',
                    perspective: { assetStack: ['ASSET#A'] },
                    characterId: 'CHARACTER#C',
                    allowGeneration: false,
                },
            },
            { ensureAuthoredCatalog: ensureObjectShortNameCacheRecord },
        )
        expect(mockPrepareFeatureKnowledgeRenderForCharacter).not.toHaveBeenCalled()
    })

    it('mints a fresh bundleId per event, not shared across separate look events', async () => {
        await handleLookCommandRequestedForRenderOrchestration(messageBus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'ROOM#X',
            confidence: 1,
        }, streamEvent)
        await handleLookCommandRequestedForRenderOrchestration(messageBus, {
            type: 'Look Command Requested',
            characterId: 'CHARACTER#C',
            componentId: 'ROOM#X',
            confidence: 1,
        }, streamEvent)

        const firstBundleId = mockRegisterIngressSlot.mock.calls[0][1]
        const secondBundleId = mockRegisterIngressSlot.mock.calls[1][1]
        expect(firstBundleId).not.toBe(secondBundleId)
    })
})
