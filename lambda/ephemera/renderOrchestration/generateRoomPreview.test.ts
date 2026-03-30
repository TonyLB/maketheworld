jest.mock('uuid', () => ({
    __esModule: true,
    v4: () => 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
}))

import { generateRoomPreview } from './generateRoomPreview'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
} from '../renderCache/baseClasses'

const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
    markValue: entries
})

describe('renderOrchestration/generateRoomPreview', () => {
    const roomId = 'ROOM#test-room' as const
    const noopPublishPutCacheRecord = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        noopPublishPutCacheRecord.mockResolvedValue(undefined)
    })

    it('returns CONTEXT_REQUIRED when no generationContextWml', async () => {
        const sendMessage = jest.fn().mockResolvedValue(undefined)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one']
        }, { publishPutCacheRecord: noopPublishPutCacheRecord, sendMessage })

        expect(result).toEqual({
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        })
        expect(sendMessage).toHaveBeenCalledTimes(0)
    })

    it('returns CONTEXT_REQUIRED when invalid generationContextWml', async () => {
        const sendMessage = jest.fn().mockResolvedValue(undefined)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one'],
            generationContextWml: '<not valid wml<<'
        }, { publishPutCacheRecord: noopPublishPutCacheRecord, sendMessage })

        expect(result).toEqual({
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        })
        expect(sendMessage).toHaveBeenCalledTimes(0)
    })

    it('returns NO_EXACT_MATCH from stub when valid generationContextWml but generation fails', async () => {
        const sendMessage = jest.fn().mockResolvedValue(undefined)

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
                generateRoomDescriptionImpl,
                queryCacheRecordsForComponentImpl,
                publishPutCacheRecord: noopPublishPutCacheRecord,
                sendMessage
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
        expect(sendMessage).toHaveBeenCalledTimes(1)
        expect(sendMessage).toHaveBeenCalledWith('generating')
    })

    it('calls publishPutCacheRecord with generated provenance when LLM returns success', async () => {
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
                generateRoomDescriptionImpl,
                queryCacheRecordsForComponentImpl,
                publishPutCacheRecord
            }
        )

        expect(result.success).toBe(true)
        if (!result.success) {
            throw new Error('expected success')
        }
        expect(result.renderedContent).toEqual(renderedContent)
        expect(result.cacheId).toBe('CACHE#aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee')
        expect(result.cacheRecord).toMatchObject({
            EphemeraId: roomId,
            DataCategory: result.cacheId,
            markState,
            renderedContent,
            provenance: { type: 'generated' },
            perspectiveMatcher: { requiredAssetIds: assetStack, forbiddenAssetIds: [] },
        })
        expect(typeof result.cacheRecord.perspectiveId).toBe('string')
        expect(publishPutCacheRecord).toHaveBeenCalledTimes(1)
        expect(publishPutCacheRecord).toHaveBeenCalledWith(
            roomId,
            expect.objectContaining({
                markState,
                renderedContent,
                provenance: { type: 'generated' },
                perspectiveMatcher: { requiredAssetIds: assetStack, forbiddenAssetIds: [] }
            }),
            'CACHE#aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
            undefined
        )
    })

    it('passes conversationId to publishPutCacheRecord when provided in options', async () => {
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
                generateRoomDescriptionImpl,
                queryCacheRecordsForComponentImpl,
                publishPutCacheRecord,
                conversationId: 'conv-thread-1',
            }
        )

        expect(publishPutCacheRecord).toHaveBeenCalledWith(
            roomId,
            expect.objectContaining({ provenance: { type: 'generated' } }),
            'CACHE#aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
            'conv-thread-1'
        )
    })
})
