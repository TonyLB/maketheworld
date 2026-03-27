import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../renderCache/baseClasses'

import internalCache from '../internalCache'
import requestIntakeMessage from './requestIntake'
import type { RenderPreviewRequested, RenderRequested } from './events'
import { generateRoomPreview } from './generateRoomPreview'
import {
    handleRenderOrchestrationMessage,
    isRenderOrchestrationRequestMessage,
    registerRenderOrchestration,
} from './index'

jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        Conversations: {
            get: jest.fn(),
        },
        RenderCache: {
            getExactMatch: jest.fn(),
        },
    },
}))

jest.mock('./generateRoomPreview', () => ({
    generateRoomPreview: jest.fn(),
}))

jest.mock('./requestIntake', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

const mockConversationsGet = jest.mocked(internalCache.Conversations.get)
const mockGetExactMatch = jest.mocked(internalCache.RenderCache.getExactMatch)
const mockGenerateRoomPreview = jest.mocked(generateRoomPreview)
const mockRequestIntakeMessage = jest.mocked(requestIntakeMessage)

const roomId = 'ROOM#test-room' as EphemeraRoomId
const conversationId = '550e8400-e29b-41d4-a716-446655440000'

const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
    markValue: entries,
})

const baseCacheRecord = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
    EphemeraId: roomId,
    DataCategory: 'CACHE#hit',
    markState: makeMarkState([]),
    renderedContent: { description: ['cached'] },
    provenance: { type: 'authored' },
    perspectiveId: 'PERSPECTIVE#mock',
    perspectiveMatcher: {
        requiredAssetIds: ['ASSET#one'],
        forbiddenAssetIds: [],
    },
    ...overrides,
})

const makeRenderPreviewRequested = (
    overrides: Partial<{
        markState: EphemeraCacheMarkState;
        generationContextWml: string;
    }> = {}
): RenderPreviewRequested =>
    ({
        type: 'RenderPreviewRequested' as const,
        componentId: roomId,
        perspective: { assetStack: ['ASSET#one', 'ASSET#two'] as AssetUUID[] },
        markState: overrides.markState ?? makeMarkState([{ mark: 'MARK#a', value: 'x' }]),
        conversationId,
        ...(overrides.generationContextWml !== undefined
            ? { generationContextWml: overrides.generationContextWml }
            : {}),
    })

const makeRenderRequested = (): RenderRequested =>
    ({
        type: 'RenderRequested' as const,
        componentId: roomId,
        perspective: { assetStack: ['ASSET#a', 'ASSET#b'] as AssetUUID[] },
    })

describe('renderOrchestration/index', () => {
    let messageBus: MessageBus

    beforeEach(() => {
        jest.clearAllMocks()
        mockRequestIntakeMessage.mockResolvedValue(undefined)
        messageBus = new MessageBus()
    })

    describe('handleRenderOrchestrationMessage (preview path)', () => {
        it('on exact-match hit: sends terminal success via conversation handle and does not call generateRoomPreview', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            const record = baseCacheRecord()
            mockGetExactMatch.mockResolvedValue(record)

            const payload = makeRenderPreviewRequested()
            await handleRenderOrchestrationMessage({
                payloads: [payload],
                messageBus,
            })

            expect(mockGetExactMatch).toHaveBeenCalledWith({
                componentId: roomId,
                proposedMarkState: payload.markState,
                perspective: { assetStack: ['ASSET#one', 'ASSET#two'] },
            })
            expect(sendMessage).toHaveBeenCalledTimes(1)
            expect(sendMessage).toHaveBeenCalledWith({
                success: true,
                renderedContent: record.renderedContent,
            })
            expect(mockGenerateRoomPreview).not.toHaveBeenCalled()
        })

        it('on exact-match miss: calls generateRoomPreview and sends its result', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            mockGetExactMatch.mockResolvedValue(null)
            const genResult = {
                success: true as const,
                renderedContent: { description: ['generated'] },
            }
            mockGenerateRoomPreview.mockResolvedValue(genResult)

            const payload = makeRenderPreviewRequested({
                generationContextWml: '<Asset uuid=(test)><Room uuid=(r) key=(r)><ShortName>X</ShortName></Room></Asset>',
            })
            await handleRenderOrchestrationMessage({
                payloads: [payload],
                messageBus,
            })

            expect(mockGenerateRoomPreview).toHaveBeenCalledTimes(1)
            expect(mockGenerateRoomPreview).toHaveBeenCalledWith(
                {
                    roomId: payload.componentId,
                    markState: payload.markState,
                    assetStack: payload.perspective.assetStack,
                    generationContextWml: payload.generationContextWml,
                },
                expect.objectContaining({
                    conversationId: payload.conversationId,
                    onGenerating: expect.any(Function),
                })
            )
            expect(sendMessage).toHaveBeenCalledWith(genResult)
        })

        it('on exact-match miss: invokes onGenerating before terminal sendMessage when generateRoomPreview uses slow path', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            mockGetExactMatch.mockResolvedValue(null)

            let onGeneratingCallback: (() => Promise<void>) | undefined
            mockGenerateRoomPreview.mockImplementation(async (_input, options) => {
                onGeneratingCallback = options?.onGenerating
                await options?.onGenerating?.()
                return { success: true, renderedContent: { description: [] } }
            })

            await handleRenderOrchestrationMessage({
                payloads: [
                    makeRenderPreviewRequested({
                        generationContextWml: '<Asset uuid=(test)><Room uuid=(r) key=(r)><ShortName>X</ShortName></Room></Asset>',
                    }),
                ],
                messageBus,
            })

            expect(onGeneratingCallback).toEqual(expect.any(Function))
            expect(sendMessage.mock.calls[0][0]).toBe('generating')
            expect(sendMessage.mock.calls[1][0]).toEqual(
                expect.objectContaining({ success: true })
            )
        })

        it('when conversation handle is missing, exact-match hit does not throw and does not call generateRoomPreview', async () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
            mockConversationsGet.mockReturnValue(undefined)
            mockGetExactMatch.mockResolvedValue(baseCacheRecord())

            await handleRenderOrchestrationMessage({
                payloads: [makeRenderPreviewRequested()],
                messageBus,
            })

            expect(mockGenerateRoomPreview).not.toHaveBeenCalled()
            consoleError.mockRestore()
        })
    })

    describe('handleRenderOrchestrationMessage (RenderRequested path)', () => {
        it('forwards only RenderRequested payloads to requestIntakeMessage', async () => {
            const rr = makeRenderRequested()
            await handleRenderOrchestrationMessage({
                payloads: [rr],
                messageBus,
            })

            expect(mockRequestIntakeMessage).toHaveBeenCalledWith({
                payloads: [rr],
                messageBus,
            })
            expect(mockGetExactMatch).not.toHaveBeenCalled()
            expect(mockGenerateRoomPreview).not.toHaveBeenCalled()
        })
    })

    describe('handleRenderOrchestrationMessage (batching)', () => {
        it('runs request intake and preview handling in parallel for mixed payloads', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            mockGetExactMatch.mockResolvedValue(baseCacheRecord())

            const rr = makeRenderRequested()
            const preview = makeRenderPreviewRequested()

            await handleRenderOrchestrationMessage({
                payloads: [rr, preview],
                messageBus,
            })

            expect(mockRequestIntakeMessage).toHaveBeenCalledWith({
                payloads: [rr],
                messageBus,
            })
            expect(mockGetExactMatch).toHaveBeenCalled()
            expect(mockGenerateRoomPreview).not.toHaveBeenCalled()
        })
    })

    describe('registerRenderOrchestration', () => {
        it('subscribes with tag, priority, filter, and handleRenderOrchestrationMessage callback', () => {
            const subscribeSpy = jest.spyOn(MessageBus.prototype, 'subscribe')
            const bus = new MessageBus()

            const { unsubscribeAll } = registerRenderOrchestration(bus)

            expect(subscribeSpy).toHaveBeenCalledTimes(1)
            const subscription = subscribeSpy.mock.calls[0][0]
            expect(subscription.tag).toBe('RenderOrchestration.Requests')
            expect(subscription.priority).toBe(5)
            expect(subscription.filter).toBe(isRenderOrchestrationRequestMessage)
            expect(subscription.callback).toBe(handleRenderOrchestrationMessage)
            expect(typeof unsubscribeAll).toBe('function')
            subscribeSpy.mockRestore()
        })
    })
})
