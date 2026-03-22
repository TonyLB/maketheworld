import { generateRoomPreview } from './generateRoomPreview'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheDynamoItem,
    EphemeraCacheRenderedContent
} from '../renderCache/baseClasses'

const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
    markValue: entries
})

const baseRecord = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
    EphemeraId: 'ROOM#test-room' as const,
    DataCategory: 'CACHE#test',
    markState: makeMarkState([]),
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
    perspectiveId: 'PERSPECTIVE#mocked',
    perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
    ...overrides
})

describe('renderOrchestration/generateRoomPreview', () => {
    const roomId = 'ROOM#test-room' as const
    const noopPublishPutCacheRecord = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        noopPublishPutCacheRecord.mockResolvedValue(undefined)
    })

    it('builds perspective from assetStack and passes it to getExactMatchImpl', async () => {
        const getExactMatchImpl = jest.fn().mockResolvedValue(null)

        const markState = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
        const assetStack = ['ASSET#one', 'ASSET#two']

        await generateRoomPreview({
            roomId,
            markState,
            assetStack
        }, { getExactMatchImpl, publishPutCacheRecord: noopPublishPutCacheRecord })

        expect(getExactMatchImpl).toHaveBeenCalledWith({
            componentId: roomId,
            proposedMarkState: markState,
            perspective: { assetStack }
        })
    })

    it('returns success with renderedContent when a match is found', async () => {
        const getExactMatchImpl = jest.fn()

        const renderedContent: EphemeraCacheRenderedContent = { description: [] }
        const record = baseRecord({ renderedContent })

        getExactMatchImpl.mockResolvedValue(record)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one']
        }, { getExactMatchImpl, publishPutCacheRecord: noopPublishPutCacheRecord })

        expect(result).toEqual({
            success: true,
            renderedContent
        })
    })

    it('returns CONTEXT_REQUIRED when no exact match and no generationContextWml', async () => {
        const getExactMatchImpl = jest.fn().mockResolvedValue(null)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one']
        }, { getExactMatchImpl, publishPutCacheRecord: noopPublishPutCacheRecord })

        expect(result).toEqual({
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        })
    })

    it('returns CONTEXT_REQUIRED when no exact match and invalid generationContextWml', async () => {
        const getExactMatchImpl = jest.fn().mockResolvedValue(null)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one'],
            generationContextWml: '<not valid wml<<'
        }, { getExactMatchImpl, publishPutCacheRecord: noopPublishPutCacheRecord })

        expect(result).toEqual({
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        })
    })

    it('returns NO_EXACT_MATCH from stub when no exact match but valid generationContextWml', async () => {
        const getExactMatchImpl = jest.fn().mockResolvedValue(null)

        const generateRoomDescriptionImpl = jest.fn().mockResolvedValue({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state'
        })

        const queryCacheRecordsForComponentImpl = jest.fn().mockResolvedValue([])
        const validWml = '<Asset uuid=(test)><Room uuid=(room1) key=(room1)><ShortName>Test</ShortName></Room></Asset>'
        const result = await generateRoomPreview(
            {
                roomId,
                markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
                assetStack: ['ASSET#one'],
                generationContextWml: validWml
            },
            {
                getExactMatchImpl,
                generateRoomDescriptionImpl,
                queryCacheRecordsForComponentImpl,
                publishPutCacheRecord: noopPublishPutCacheRecord
            }
        )

        expect(queryCacheRecordsForComponentImpl).toHaveBeenCalledWith(roomId)
        expect(generateRoomDescriptionImpl).toHaveBeenCalledWith(
            expect.objectContaining({
                roomId,
                markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
                perspective: { assetStack: ['ASSET#one'] },
                cachedExamples: []
            })
        )
        expect(result).toEqual({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state'
        })
    })

    it('calls publishPutCacheRecord with generated provenance when LLM returns success', async () => {
        const getExactMatchImpl = jest.fn().mockResolvedValue(null)

        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['Generated Name'],
            summary: ['Generated summary.'],
            description: ['Generated description.']
        }
        const generateRoomDescriptionImpl = jest.fn().mockResolvedValue({
            success: true,
            renderedContent
        })
        const queryCacheRecordsForComponentImpl = jest.fn().mockResolvedValue([])
        const publishPutCacheRecord = jest.fn().mockResolvedValue(undefined)

        const validWml = '<Asset uuid=(test)><Room uuid=(room1) key=(room1)><ShortName>Test</ShortName></Room></Asset>'
        const markState = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
        const assetStack = ['ASSET#one']

        const result = await generateRoomPreview(
            {
                roomId,
                markState,
                assetStack,
                generationContextWml: validWml
            },
            {
                getExactMatchImpl,
                generateRoomDescriptionImpl,
                queryCacheRecordsForComponentImpl,
                publishPutCacheRecord
            }
        )

        expect(result).toEqual({ success: true, renderedContent })
        expect(publishPutCacheRecord).toHaveBeenCalledTimes(1)
        expect(publishPutCacheRecord).toHaveBeenCalledWith(
            roomId,
            expect.objectContaining({
                markState,
                renderedContent,
                provenance: { type: 'generated' },
                perspectiveMatcher: { requiredAssetIds: assetStack, forbiddenAssetIds: [] }
            }),
            undefined,
            undefined
        )
    })

    it('passes conversationId to publishPutCacheRecord when provided in options', async () => {
        const getExactMatchImpl = jest.fn().mockResolvedValue(null)

        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: [],
            summary: [],
            description: [],
        }
        const generateRoomDescriptionImpl = jest.fn().mockResolvedValue({
            success: true,
            renderedContent,
        })
        const queryCacheRecordsForComponentImpl = jest.fn().mockResolvedValue([])
        const publishPutCacheRecord = jest.fn().mockResolvedValue(undefined)

        const validWml = '<Asset uuid=(test)><Room uuid=(room1) key=(room1)><ShortName>Test</ShortName></Room></Asset>'
        const markState = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
        const assetStack = ['ASSET#one']

        await generateRoomPreview(
            {
                roomId,
                markState,
                assetStack,
                generationContextWml: validWml,
            },
            {
                getExactMatchImpl,
                generateRoomDescriptionImpl,
                queryCacheRecordsForComponentImpl,
                publishPutCacheRecord,
                conversationId: 'conv-thread-1',
            }
        )

        expect(publishPutCacheRecord).toHaveBeenCalledWith(
            roomId,
            expect.objectContaining({ provenance: { type: 'generated' } }),
            undefined,
            'conv-thread-1'
        )
    })
})
