import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../renderCache/baseClasses'

import internalCache from '../internalCache'
import { orchestratePassiveRenderRequestedBatch } from './passiveRenderOrchestration'
import type { RenderPreviewRequested, RenderRequested } from './events'
import { generateRoomPreview } from './generateRoomPreview'
import {
    handleRenderOrchestrationMessage,
    isRenderOrchestrationRequestMessage,
    registerRenderOrchestration,
} from './index'
import * as findRenderModule from './findRender'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from './baseClasses'

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

jest.mock('./passiveRenderOrchestration', () => ({
    __esModule: true,
    orchestratePassiveRenderRequestedBatch: jest.fn().mockResolvedValue(undefined),
    requestIntakeMessage: jest.fn(),
}))

const mockConversationsGet = jest.mocked(internalCache.Conversations.get)
const mockGetExactMatch = jest.mocked(internalCache.RenderCache.getExactMatch)
const mockGenerateRoomPreview = jest.mocked(generateRoomPreview)
const mockOrchestratePassiveRenderRequestedBatch = jest.mocked(orchestratePassiveRenderRequestedBatch)

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
        mockOrchestratePassiveRenderRequestedBatch.mockResolvedValue(undefined)
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
                type: 'resolved',
                renderedContent: record.renderedContent,
                cacheId: record.DataCategory as EphemeraCacheId,
                cacheRecord: record,
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
                cacheId: 'CACHE#gen-test-0000-4000-8000-000000000001' as EphemeraCacheId,
                cacheRecord: {
                    EphemeraId: roomId,
                    DataCategory: 'CACHE#gen-test-0000-4000-8000-000000000001',
                    markState: makeMarkState([{ mark: 'MARK#a', value: 'x' }]),
                    renderedContent: { description: ['generated'] },
                    provenance: { type: 'generated' as const },
                    perspectiveId: 'P#gen',
                    perspectiveMatcher: {
                        requiredAssetIds: ['ASSET#one', 'ASSET#two'],
                        forbiddenAssetIds: [] as AssetUUID[],
                    },
                } satisfies EphemeraCacheDynamoItem,
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
            expect(sendMessage).toHaveBeenCalledWith({
                type: 'resolved',
                renderedContent: genResult.renderedContent,
                cacheId: genResult.cacheId,
                cacheRecord: genResult.cacheRecord,
            })
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
                const cacheId = 'CACHE#slow-path-0000-4000-8000-000000000001' as EphemeraCacheId
                return {
                    success: true,
                    renderedContent: { description: [] },
                    cacheId,
                    cacheRecord: {
                        EphemeraId: roomId,
                        DataCategory: cacheId,
                        markState: makeMarkState([{ mark: 'MARK#a', value: 'x' }]),
                        renderedContent: { description: [] },
                        provenance: { type: 'generated' },
                        perspectiveId: 'P#slow',
                        perspectiveMatcher: {
                            requiredAssetIds: ['ASSET#one', 'ASSET#two'],
                            forbiddenAssetIds: [],
                        },
                    },
                }
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
            expect(sendMessage.mock.calls[1][0]).toMatchObject({
                type: 'resolved',
                renderedContent: { description: [] },
            })
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
        it('forwards only RenderRequested payloads to orchestratePassiveRenderRequestedBatch', async () => {
            const rr = makeRenderRequested()
            await handleRenderOrchestrationMessage({
                payloads: [rr],
                messageBus,
            })

            expect(mockOrchestratePassiveRenderRequestedBatch).toHaveBeenCalledWith({
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

            expect(mockOrchestratePassiveRenderRequestedBatch).toHaveBeenCalledWith({
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

    /**
     * Preview terminal path after `findRender`: forwarded by `findRender` through `sendMessage`.
     * Spies `findRender` to assert preview receives emitted resolve shapes.
     */
    describe('preview terminal delivery (orchestration)', () => {
        let findRenderSpy: jest.SpiedFunction<typeof findRenderModule.findRender>

        beforeEach(() => {
            findRenderSpy = jest.spyOn(findRenderModule, 'findRender')
        })

        afterEach(() => {
            findRenderSpy.mockRestore()
        })

        it('does nothing when handle is undefined', async () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
            mockConversationsGet.mockReturnValue(undefined)
            const record = baseCacheRecord()
            findRenderSpy.mockResolvedValue({
                type: 'resolved',
                renderedContent: record.renderedContent,
                cacheId: record.DataCategory as EphemeraCacheId,
                cacheRecord: record,
            })
            await handleRenderOrchestrationMessage({
                payloads: [makeRenderPreviewRequested()],
                messageBus,
            })
            expect(mockGenerateRoomPreview).not.toHaveBeenCalled()
            consoleError.mockRestore()
        })

        it('sendMessage with RenderResolveOutput resolved', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            const record = baseCacheRecord()
            const output = {
                type: 'resolved' as const,
                renderedContent: record.renderedContent,
                cacheId: record.DataCategory as EphemeraCacheId,
                cacheRecord: record,
            }
            findRenderSpy.mockImplementation(async (_resolve, deps) => {
                await deps.sendMessage(output)
                return output
            })
            await handleRenderOrchestrationMessage({
                payloads: [makeRenderPreviewRequested()],
                messageBus,
            })
            expect(sendMessage).toHaveBeenCalledWith(output)
        })

        it('sendMessage with RenderResolveOutput failed', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            const output = {
                type: 'failed' as const,
                errorCode: 'CONTEXT_REQUIRED' as const,
                errorMessage: 'Generation context required',
            }
            findRenderSpy.mockImplementation(async (_resolve, deps) => {
                await deps.sendMessage(output)
                return output
            })
            await handleRenderOrchestrationMessage({
                payloads: [makeRenderPreviewRequested()],
                messageBus,
            })
            expect(sendMessage).toHaveBeenCalledWith(output)
        })

        it('forwards invalidate to sendMessage with same output', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            const output = {
                type: 'invalidate' as const,
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            }
            findRenderSpy.mockImplementation(async (_resolve, deps) => {
                await deps.sendMessage(output)
                return output
            })
            await handleRenderOrchestrationMessage({
                payloads: [makeRenderPreviewRequested()],
                messageBus,
            })
            expect(sendMessage).toHaveBeenCalledWith(output)
        })

        it('forwards META_ROOM_MARKS_MISSING to sendMessage', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            const output = {
                type: 'failed' as const,
                errorCode: 'META_ROOM_MARKS_MISSING' as const,
                errorMessage: 'x',
            }
            findRenderSpy.mockImplementation(async (_resolve, deps) => {
                await deps.sendMessage(output)
                return output
            })
            await handleRenderOrchestrationMessage({
                payloads: [makeRenderPreviewRequested()],
                messageBus,
            })
            expect(sendMessage).toHaveBeenCalledWith(output)
        })

        it('forwards resolved missing cacheId to sendMessage', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            const record = baseCacheRecord()
            const output = {
                type: 'resolved' as const,
                renderedContent: record.renderedContent,
            }
            findRenderSpy.mockImplementation(async (_resolve, deps) => {
                await deps.sendMessage(output)
                return output
            })
            await handleRenderOrchestrationMessage({
                payloads: [makeRenderPreviewRequested()],
                messageBus,
            })
            expect(sendMessage).toHaveBeenCalledWith(output)
        })
    })
})
