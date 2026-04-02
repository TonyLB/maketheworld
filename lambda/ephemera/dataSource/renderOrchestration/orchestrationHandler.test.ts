import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { MessageBus } from '../../messageBus/baseClasses'
import type { MessageBus as MessageBusType } from '../../messageBus/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../../renderCache/baseClasses'
import internalCache from '../../internalCache'
import * as orchestrationHandlerModule from './orchestrationHandler'
import { orchestrateRenderRequest } from './orchestrationHandler'
import type { RenderPreviewRequested, RenderRequested } from './events'
import * as findRenderModule from './findRender'
import * as generateRoomPreviewModule from './generateRoomPreview'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from './baseClasses'

const actualOrchestrateRenderRequest = jest.requireActual<typeof orchestrationHandlerModule>(
    './orchestrationHandler'
).orchestrateRenderRequest

describe('dataSource/renderOrchestration/orchestrationHandler', () => {
    beforeEach(() => {
        internalCache.clear()
    })

    const basePayload: RenderRequested = {
        type: 'RenderRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] },
        allowGeneration: false,
    }

    const baseMetaRoom: EphemeraMetaRoom = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'Meta::Room',
        state: { marks: { markValue: [{ mark: 'MARK#a', value: 'one' }] } },
        currentCacheByPerspective: {
            'PERSPECTIVE#v1#abc': 'CACHE#valid'
        }
    }

    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] }
    }

    const makeBus = (): MessageBusType => ({ send: jest.fn() } as unknown as MessageBusType)

    it('emits RenderReady on valid fast-path hit', async () => {
        const messageBus = makeBus()
        const getCacheRecordById = jest.fn().mockResolvedValue(baseCacheRecord)
        const getExactMatch = jest.fn()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById,
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn().mockReturnValue(true)
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid'
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
        expect(getCacheRecordById).toHaveBeenCalledWith('ROOM#one', 'CACHE#valid')
        expect(getExactMatch).not.toHaveBeenCalled()
    })

    it('emits lookup handoff when no pointer exists', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(null)
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
        expect(getExactMatch).toHaveBeenCalled()
    })

    it('clears pointer and emits lookup handoff when record missing', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer,
                markStatesEqual: jest.fn()
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalledWith('ROOM#one', 'PERSPECTIVE#v1#abc')
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('emits RenderReady on exact-match hit when no pointer exists', async () => {
        const messageBus = makeBus()
        const getExactMatch = jest.fn().mockResolvedValue(baseCacheRecord)
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch,
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid'
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
        expect(getExactMatch).toHaveBeenCalled()
    })

    it('emits RenderError and does not clear pointer when state marks missing', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, state: undefined }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(baseCacheRecord),
                getExactMatch: jest.fn(),
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(false)
            }
        )
        expect(clearPerspectivePointer).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: expect.stringContaining('Meta::Room.state.marks'),
            componentId: 'ROOM#one',
        }))
    })

    it('emits RenderError when Meta::Room is missing', async () => {
        const messageBus = makeBus()
        const getCacheRecordById = jest.fn()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(undefined),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById,
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(getCacheRecordById).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: expect.stringContaining('Meta::Room.state.marks'),
            componentId: 'ROOM#one',
        }))
    })

    it('clears pointer and emits lookup handoff when markState mismatch', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(baseCacheRecord),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(false)
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('clears pointer and emits lookup handoff when perspective mismatches', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        const cacheRecord = {
            ...baseCacheRecord,
            perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] }
        }
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(cacheRecord),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer,
                markStatesEqual: jest.fn().mockReturnValue(true)
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('continues to lookup handoff if pointer clearing fails', async () => {
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn().mockRejectedValue(new Error('boom')),
                markStatesEqual: jest.fn()
            }
        )
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('emits RenderReady on exact-match hit after invalid pointer', async () => {
        const clearPerspectivePointer = jest.fn().mockResolvedValue(undefined)
        const messageBus = makeBus()
        await orchestrateRenderRequest(
            { payload: basePayload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue(baseMetaRoom),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn().mockResolvedValue(undefined),
                getExactMatch: jest.fn().mockResolvedValue(baseCacheRecord),
                clearPerspectivePointer,
                markStatesEqual: jest.fn()
            }
        )
        expect(clearPerspectivePointer).toHaveBeenCalledWith('ROOM#one', 'PERSPECTIVE#v1#abc')
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#valid'
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('bypasses room fast-path for non-room componentIds', async () => {
        const messageBus = makeBus()
        const payload: RenderRequested = { ...basePayload, componentId: 'FEATURE#one' }
        const getMetaRoom = jest.fn()
        await orchestrateRenderRequest(
            { payload, messageBus },
            {
                getMetaRoom,
                computePerspectiveKey: jest.fn(),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn(),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn()
            }
        )
        expect(getMetaRoom).not.toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'NOT_ROOM',
        }))
    })

    it('runs generation and emits RenderReady when allowGeneration and no cache hit', async () => {
        const generatedRow: EphemeraCacheDynamoItem = {
            ...baseCacheRecord,
            DataCategory: 'CACHE#generated',
            provenance: { type: 'generated' },
        }
        const generateRoomPreview = jest.fn().mockImplementation(async (_input, options) => {
            await options?.sendMessage?.('generating')
            await options?.sendMessage?.({
                type: 'resolved',
                renderedContent: { description: [{ tag: 'String', value: 'Generated' }] },
                cacheId: 'CACHE#generated',
                cacheRecord: generatedRow,
            })
            return 'success'
        })
        const messageBus = makeBus()
        const payload: RenderRequested = {
            ...basePayload,
            allowGeneration: true,
            generationContextWml: '<Asset key=(Test) />',
        }
        await orchestrateRenderRequest(
            { payload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        expect(generateRoomPreview).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderReady',
            cacheId: 'CACHE#generated',
        }))
        expect(messageBus.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RenderInvalidate' }))
    })

    it('emits RenderError when allowGeneration set but generation returns CONTEXT_REQUIRED', async () => {
        const generateRoomPreview = jest.fn().mockImplementation(async (_input, options) => {
            await options?.sendMessage?.({
                type: 'failed',
                errorCode: 'CONTEXT_REQUIRED',
                errorMessage: 'Generation context required',
            })
            return 'fail'
        })
        const messageBus = makeBus()
        const payload: RenderRequested = {
            ...basePayload,
            allowGeneration: true,
        }
        await orchestrateRenderRequest(
            { payload, messageBus },
            {
                getMetaRoom: jest.fn().mockResolvedValue({ ...baseMetaRoom, currentCacheByPerspective: {} }),
                computePerspectiveKey: jest.fn().mockReturnValue('PERSPECTIVE#v1#abc'),
                getCacheRecordById: jest.fn(),
                getExactMatch: jest.fn().mockResolvedValue(null),
                clearPerspectivePointer: jest.fn(),
                markStatesEqual: jest.fn(),
                generateRoomPreview,
            }
        )
        expect(generateRoomPreview).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'RenderError',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
            componentId: 'ROOM#one',
        }))
    })

    /**
     * RenderPreviewRequested integration (historically exercised via a renderOrchestration barrel test).
     * Calls orchestrateRenderRequest directly; uses spies on internalCache / generateRoomPreview / findRender.
     */
    describe('RenderPreviewRequested preview path', () => {
        const previewRoomId = 'ROOM#test-room' as EphemeraRoomId
        const previewConversationId = '550e8400-e29b-41d4-a716-446655440000'

        let messageBus: MessageBus
        let mockConversationsGet: jest.SpyInstance
        let mockGetExactMatch: jest.SpyInstance
        let mockGenerateRoomPreview: jest.Mock

        const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
            markValue: entries,
        })

        const previewBaseCacheRecord = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
            EphemeraId: previewRoomId,
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
                componentId: previewRoomId,
                perspective: { assetStack: ['ASSET#one', 'ASSET#two'] as AssetUUID[] },
                markState: overrides.markState ?? makeMarkState([{ mark: 'MARK#a', value: 'x' }]),
                conversationId: previewConversationId,
                ...(overrides.generationContextWml !== undefined
                    ? { generationContextWml: overrides.generationContextWml }
                    : {}),
            })

        const makeRenderRequestedPreviewSuite = (): RenderRequested =>
            ({
                type: 'RenderRequested' as const,
                componentId: previewRoomId,
                perspective: { assetStack: ['ASSET#a', 'ASSET#b'] as AssetUUID[] },
            })

        beforeEach(() => {
            jest.clearAllMocks()
            messageBus = new MessageBus()
            mockConversationsGet = jest.spyOn(internalCache.Conversations, 'get')
            mockGetExactMatch = jest.spyOn(internalCache.RenderCache, 'getExactMatch')
            mockGenerateRoomPreview = jest.fn()
            jest.spyOn(generateRoomPreviewModule, 'generateRoomPreview').mockImplementation(mockGenerateRoomPreview)
        })

        afterEach(() => {
            mockConversationsGet.mockRestore()
            mockGetExactMatch.mockRestore()
            jest.restoreAllMocks()
        })

        it('on exact-match hit: sends terminal success via conversation handle and does not call generateRoomPreview', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            const record = previewBaseCacheRecord()
            mockGetExactMatch.mockResolvedValue(record)

            const payload = makeRenderPreviewRequested()
            await orchestrateRenderRequest({ payload, messageBus })

            expect(mockGetExactMatch).toHaveBeenCalledWith({
                componentId: previewRoomId,
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
                renderedContent: { description: ['generated'] },
                cacheId: 'CACHE#gen-test-0000-4000-8000-000000000001' as EphemeraCacheId,
                cacheRecord: {
                    EphemeraId: previewRoomId,
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
            mockGenerateRoomPreview.mockImplementation(async (_input, options) => {
                await options?.sendMessage?.('generating')
                await options?.sendMessage?.({
                    type: 'resolved',
                    renderedContent: genResult.renderedContent,
                    cacheId: genResult.cacheId,
                    cacheRecord: genResult.cacheRecord,
                })
                return 'success'
            })

            const payload = makeRenderPreviewRequested({
                generationContextWml: '<Asset uuid=(test)><Room uuid=(r) key=(r)><ShortName>X</ShortName></Room></Asset>',
            })
            await orchestrateRenderRequest({ payload, messageBus })

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
                    sendMessage: expect.any(Function),
                })
            )
            expect(sendMessage).toHaveBeenCalledWith({
                type: 'resolved',
                renderedContent: genResult.renderedContent,
                cacheId: genResult.cacheId,
                cacheRecord: genResult.cacheRecord,
            })
        })

        it('on exact-match miss: invokes sendMessage with generating before terminal sendMessage when generateRoomPreview uses slow path', async () => {
            const sendMessage = jest.fn().mockResolvedValue(undefined)
            mockConversationsGet.mockReturnValue({
                record: {} as never,
                handle: {
                    kind: 'conversationCompositeReadGenerateRoomPreview',
                    sendMessage,
                },
            })
            mockGetExactMatch.mockResolvedValue(null)

            mockGenerateRoomPreview.mockImplementation(async (_input, options) => {
                await options?.sendMessage?.('generating')
                const cacheId = 'CACHE#slow-path-0000-4000-8000-000000000001' as EphemeraCacheId
                const cacheRecord = {
                    EphemeraId: previewRoomId,
                    DataCategory: cacheId,
                    markState: makeMarkState([{ mark: 'MARK#a', value: 'x' }]),
                    renderedContent: { description: [] },
                    provenance: { type: 'generated' },
                    perspectiveId: 'P#slow',
                    perspectiveMatcher: {
                        requiredAssetIds: ['ASSET#one', 'ASSET#two'],
                        forbiddenAssetIds: [],
                    },
                } satisfies EphemeraCacheDynamoItem
                await options?.sendMessage?.({
                    type: 'resolved',
                    renderedContent: { description: [] },
                    cacheId,
                    cacheRecord,
                })
                return 'success'
            })

            await orchestrateRenderRequest({
                payload: makeRenderPreviewRequested({
                    generationContextWml: '<Asset uuid=(test)><Room uuid=(r) key=(r)><ShortName>X</ShortName></Room></Asset>',
                }),
                messageBus,
            })

            expect(mockGenerateRoomPreview).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ sendMessage: expect.any(Function) }),
            )
            expect(sendMessage.mock.calls[0][0]).toBe('generating')
            expect(sendMessage.mock.calls[1][0]).toMatchObject({
                type: 'resolved',
                renderedContent: { description: [] },
            })
        })

        it('when conversation handle is missing, exact-match hit does not throw and does not call generateRoomPreview', async () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
            mockConversationsGet.mockReturnValue(undefined)
            mockGetExactMatch.mockResolvedValue(previewBaseCacheRecord())

            await orchestrateRenderRequest({ payload: makeRenderPreviewRequested(), messageBus })

            expect(mockGenerateRoomPreview).not.toHaveBeenCalled()
            consoleError.mockRestore()
        })

        describe('parallel dispatch (mixed RenderRequested + RenderPreviewRequested)', () => {
            let orchestrateSpy: jest.SpyInstance

            beforeEach(() => {
                orchestrateSpy = jest
                    .spyOn(orchestrationHandlerModule, 'orchestrateRenderRequest')
                    .mockImplementation(async (args) => {
                        if (args.payload.type === 'RenderRequested') {
                            return Promise.resolve()
                        }
                        return actualOrchestrateRenderRequest(args)
                    })
            })

            afterEach(() => {
                orchestrateSpy.mockRestore()
            })

            it('runs orchestrateRenderRequest once per payload in parallel for mixed payloads', async () => {
                const sendMessage = jest.fn().mockResolvedValue(undefined)
                mockConversationsGet.mockReturnValue({
                    record: {} as never,
                    handle: {
                        kind: 'conversationCompositeReadGenerateRoomPreview',
                        sendMessage,
                    },
                })
                mockGetExactMatch.mockResolvedValue(previewBaseCacheRecord())

                const rr = makeRenderRequestedPreviewSuite()
                const preview = makeRenderPreviewRequested()

                await Promise.all([
                    orchestrationHandlerModule.orchestrateRenderRequest({ payload: rr, messageBus }),
                    orchestrationHandlerModule.orchestrateRenderRequest({ payload: preview, messageBus }),
                ])

                expect(orchestrateSpy).toHaveBeenCalledWith({
                    payload: rr,
                    messageBus,
                })
                expect(orchestrateSpy).toHaveBeenCalledWith({
                    payload: preview,
                    messageBus,
                })
                expect(orchestrateSpy).toHaveBeenCalledTimes(2)
                expect(mockGetExactMatch).toHaveBeenCalled()
                expect(mockGenerateRoomPreview).not.toHaveBeenCalled()
            })
        })

        describe('preview terminal delivery (findRender spy)', () => {
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
                findRenderSpy.mockResolvedValue(undefined)
                await orchestrateRenderRequest({ payload: makeRenderPreviewRequested(), messageBus })
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
                const record = previewBaseCacheRecord()
                const output = {
                    type: 'resolved' as const,
                    renderedContent: record.renderedContent,
                    cacheId: record.DataCategory as EphemeraCacheId,
                    cacheRecord: record,
                }
                findRenderSpy.mockImplementation(async (_resolve, deps) => {
                    await deps.sendMessage(output)
                })
                await orchestrateRenderRequest({ payload: makeRenderPreviewRequested(), messageBus })
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
                })
                await orchestrateRenderRequest({ payload: makeRenderPreviewRequested(), messageBus })
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
                })
                await orchestrateRenderRequest({ payload: makeRenderPreviewRequested(), messageBus })
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
                })
                await orchestrateRenderRequest({ payload: makeRenderPreviewRequested(), messageBus })
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
                const record = previewBaseCacheRecord()
                const output = {
                    type: 'resolved' as const,
                    renderedContent: record.renderedContent,
                }
                findRenderSpy.mockImplementation(async (_resolve, deps) => {
                    await deps.sendMessage(output)
                })
                await orchestrateRenderRequest({ payload: makeRenderPreviewRequested(), messageBus })
                expect(sendMessage).toHaveBeenCalledWith(output)
            })
        })
    })
})
