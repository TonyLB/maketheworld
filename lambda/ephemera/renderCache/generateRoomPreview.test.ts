import { generateRoomPreview } from './generateRoomPreview'
import type {
    EphemeraCacheMarkState,
    EphemeraCacheDynamoItem,
    EphemeraCacheRenderedContent
} from './baseClasses'

jest.mock('./exampleComparison', () => ({
    findExactMatchForComponent: jest.fn()
}))

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

describe('renderCache/generateRoomPreview', () => {
    const roomId = 'ROOM#test-room' as const

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('builds perspective from assetStack and passes it to findExactMatchForComponent', async () => {
        const { findExactMatchForComponent } = jest.requireMock('./exampleComparison') as {
            findExactMatchForComponent: jest.Mock
        }

        findExactMatchForComponent.mockResolvedValue(null)

        const markState = makeMarkState([{ mark: 'MARK#a', value: 'one' }])
        const assetStack = ['ASSET#one', 'ASSET#two']

        await generateRoomPreview({
            roomId,
            markState,
            assetStack
        })

        expect(findExactMatchForComponent).toHaveBeenCalledWith({
            componentId: roomId,
            proposedMarkState: markState,
            perspective: { assetStack }
        })
    })

    it('returns success with renderedContent when a match is found', async () => {
        const { findExactMatchForComponent } = jest.requireMock('./exampleComparison') as {
            findExactMatchForComponent: jest.Mock
        }

        const renderedContent: EphemeraCacheRenderedContent = { description: [] }
        const record = baseRecord({ renderedContent })

        findExactMatchForComponent.mockResolvedValue(record)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one']
        })

        expect(result).toEqual({
            success: true,
            renderedContent
        })
    })

    it('returns CONTEXT_REQUIRED when no exact match and no generationContextWml', async () => {
        const { findExactMatchForComponent } = jest.requireMock('./exampleComparison') as {
            findExactMatchForComponent: jest.Mock
        }

        findExactMatchForComponent.mockResolvedValue(null)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one']
        })

        expect(result).toEqual({
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        })
    })

    it('returns CONTEXT_REQUIRED when no exact match and invalid generationContextWml', async () => {
        const { findExactMatchForComponent } = jest.requireMock('./exampleComparison') as {
            findExactMatchForComponent: jest.Mock
        }

        findExactMatchForComponent.mockResolvedValue(null)

        const result = await generateRoomPreview({
            roomId,
            markState: makeMarkState([{ mark: 'MARK#a', value: 'one' }]),
            assetStack: ['ASSET#one'],
            generationContextWml: '<not valid wml<<'
        })

        expect(result).toEqual({
            success: false,
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required'
        })
    })

    it('returns NO_EXACT_MATCH from stub when no exact match but valid generationContextWml', async () => {
        const { findExactMatchForComponent } = jest.requireMock('./exampleComparison') as {
            findExactMatchForComponent: jest.Mock
        }

        findExactMatchForComponent.mockResolvedValue(null)

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
            { generateRoomDescriptionImpl, queryCacheRecordsForComponentImpl }
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

    it('calls putCacheRecord with generated provenance when LLM returns success', async () => {
        const { findExactMatchForComponent } = jest.requireMock('./exampleComparison') as {
            findExactMatchForComponent: jest.Mock
        }
        findExactMatchForComponent.mockResolvedValue(null)

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
        const putCacheRecordImpl = jest.fn().mockResolvedValue('CACHE#new')

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
                putCacheRecordImpl
            }
        )

        expect(result).toEqual({ success: true, renderedContent })
        expect(putCacheRecordImpl).toHaveBeenCalledTimes(1)
        expect(putCacheRecordImpl).toHaveBeenCalledWith(
            roomId,
            expect.objectContaining({
                markState,
                renderedContent,
                provenance: { type: 'generated' },
                perspectiveMatcher: { requiredAssetIds: assetStack, forbiddenAssetIds: [] }
            })
        )
    })
})

