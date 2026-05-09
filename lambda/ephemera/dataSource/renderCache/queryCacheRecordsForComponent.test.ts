jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { queryCacheRecordsForComponent } from './queryCacheRecordsForComponent'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

/** Non-paginated `query` returns `T[]`; overload resolution on mocks prefers the envelope type. */
const mockQueryResolved = (items: unknown) => {
    (ephemeraDBMock.query as jest.Mock).mockResolvedValue(items)
}

const componentId = 'ROOM#test-room-uuid' as const

const minimalRecord = {
    markState: { markValue: [{ mark: 'MARK#mark-uuid', value: 'sunny' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' as const },
    perspectiveId: 'test-perspective',
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] }
}

describe('dataSource/renderCache/queryCacheRecordsForComponent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns cache-shaped items from ephemeraDB.query', async () => {
        const items = [
            {
                EphemeraId: componentId,
                DataCategory: 'CACHE#abc',
                markState: minimalRecord.markState,
                renderedContent: minimalRecord.renderedContent,
                provenance: minimalRecord.provenance,
                perspectiveId: minimalRecord.perspectiveId,
                perspectiveMatcher: minimalRecord.perspectiveMatcher
            }
        ]
        mockQueryResolved(items)

        const result = await queryCacheRecordsForComponent(componentId)

        expect(ephemeraDBMock.query).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.query).toHaveBeenCalledWith({
            Key: { EphemeraId: componentId },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: { ':dcPrefix': 'CACHE#' },
            allFields: true
        })
        expect(result).toEqual(items)
    })

    it('returns empty array when query returns no items', async () => {
        mockQueryResolved([])

        const result = await queryCacheRecordsForComponent(componentId)

        expect(ephemeraDBMock.query).toHaveBeenCalledWith({
            Key: { EphemeraId: componentId },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: { ':dcPrefix': 'CACHE#' },
            allFields: true
        })
        expect(result).toEqual([])
    })

    it('filters out items that fail isEphemeraCacheDynamoItem', async () => {
        const valid = {
            EphemeraId: componentId,
            DataCategory: 'CACHE#valid',
            markState: minimalRecord.markState,
            renderedContent: minimalRecord.renderedContent,
            provenance: minimalRecord.provenance,
            perspectiveId: minimalRecord.perspectiveId,
            perspectiveMatcher: minimalRecord.perspectiveMatcher
        }
        mockQueryResolved([
            valid,
            { EphemeraId: componentId, DataCategory: 'OTHER#x' } as any,
            { EphemeraId: componentId, DataCategory: 'CACHE#bad', markState: null } as any
        ])

        const result = await queryCacheRecordsForComponent(componentId)

        expect(result).toEqual([valid])
    })
})

