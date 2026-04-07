jest.mock('uuid', () => ({
    __esModule: true,
    v4: () => 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
}))

import { generateRoomPreview } from './generateRoomPreview'
import { passThroughSingleFlight } from './singleFlightRenderGeneration'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
} from '../../renderCache/baseClasses'

const makeMarkState = (entries: Array<{ mark: string; value: string }>): EphemeraCacheMarkState => ({
    markValue: entries
})

describe('dataSource/renderOrchestration/generateRoomPreview', () => {
    const roomId = 'ROOM#test-room' as const
    const noopPublishOrchestration = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        noopPublishOrchestration.mockResolvedValue(undefined)
    })

    it('emits CONTEXT_REQUIRED failure and returns fail when no generationContextWml', async () => {
        const sendMessage = jest.fn().mockResolvedValue(undefined)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one']
        }, { sendMessage, publishOrchestration: noopPublishOrchestration, runWithSingleFlight: passThroughSingleFlight })

        expect(result).toBe('fail')
        expect(sendMessage).toHaveBeenCalledTimes(1)
        expect(sendMessage).toHaveBeenCalledWith({
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
    })

    it('emits CONTEXT_REQUIRED failure and returns fail when invalid generationContextWml', async () => {
        const sendMessage = jest.fn().mockResolvedValue(undefined)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one'],
            generationContextWml: '<not valid wml<<'
        }, { sendMessage, publishOrchestration: noopPublishOrchestration, runWithSingleFlight: passThroughSingleFlight })

        expect(result).toBe('fail')
        expect(sendMessage).toHaveBeenCalledTimes(1)
        expect(sendMessage).toHaveBeenCalledWith({
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
    })

    it('emits generating then NO_EXACT_MATCH failure when valid context but generation fails', async () => {
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
                sendMessage,
                publishOrchestration: noopPublishOrchestration,
                runWithSingleFlight: passThroughSingleFlight,
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
        expect(result).toBe('fail')
        expect(sendMessage).toHaveBeenCalledTimes(2)
        expect(sendMessage).toHaveBeenNthCalledWith(1, 'generating')
        expect(sendMessage).toHaveBeenNthCalledWith(2, {
            type: 'failed',
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state',
        })
    })

    it('publishes Render Generated with full cacheRecord when LLM returns success (no Put Cache Record from orchestration)', async () => {
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
        const sendMessage = jest.fn().mockResolvedValue(undefined)

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
                sendMessage,
                publishOrchestration: noopPublishOrchestration,
                runWithSingleFlight: passThroughSingleFlight,
            }
        )

        expect(result).toBe('success')
        expect(sendMessage).toHaveBeenNthCalledWith(1, 'generating')
        expect(sendMessage).toHaveBeenNthCalledWith(2, {
            type: 'resolved',
            renderedContent,
            cacheId: 'CACHE#aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
            cacheRecord: expect.objectContaining({
                EphemeraId: roomId,
                DataCategory: 'CACHE#aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
                markState,
                renderedContent,
                provenance: { type: 'generated' },
                perspectiveMatcher: { requiredAssetIds: assetStack, forbiddenAssetIds: [] },
            }),
        })
        expect(noopPublishOrchestration).toHaveBeenCalledTimes(2)
        expect(noopPublishOrchestration).toHaveBeenNthCalledWith(1, expect.objectContaining({
            type: 'Generation Started',
            phase: 'generating',
        }))
        expect(noopPublishOrchestration).toHaveBeenNthCalledWith(2, expect.objectContaining({
            type: 'Render Generated',
            cacheId: 'CACHE#aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
            cacheRecord: expect.objectContaining({
                EphemeraId: roomId,
                DataCategory: 'CACHE#aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee',
                markState,
                renderedContent,
                provenance: { type: 'generated' },
                perspectiveMatcher: { requiredAssetIds: assetStack, forbiddenAssetIds: [] },
            }),
        }))
    })
})
