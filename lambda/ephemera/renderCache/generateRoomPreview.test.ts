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

    it('returns failure when no exact match is found', async () => {
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
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'No exact match for proposed state'
        })
    })
})

