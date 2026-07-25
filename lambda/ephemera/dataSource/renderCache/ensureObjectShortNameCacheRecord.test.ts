jest.mock('../objects/objectShortName', () => ({
    __esModule: true,
    shortNameFromMergedAggregate: jest.fn(),
    shortNameFromComponent: jest.fn(),
}))

jest.mock('./putCacheRecord', () => ({
    __esModule: true,
    putCacheRecord: jest.fn(),
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentAggregate: { get: jest.fn() },
        ImprovisationComponentData: { get: jest.fn() },
        RenderCache: { getExactMatch: jest.fn() },
    },
}))

import internalCache from '../../internalCache'
import { shortNameFromComponent, shortNameFromMergedAggregate } from '../objects/objectShortName'
import { putCacheRecord } from './putCacheRecord'
import { ensureObjectShortNameCacheRecord } from './ensureObjectShortNameCacheRecord'
import { EPHEMERA_CACHE_PROVENANCE_AUTHORED } from './baseClasses'

const shortNameFromMergedAggregateMock = shortNameFromMergedAggregate as jest.Mock
const shortNameFromComponentMock = shortNameFromComponent as jest.Mock
const putCacheRecordMock = putCacheRecord as jest.Mock
const getExactMatchMock = internalCache.RenderCache.getExactMatch as jest.Mock
const getImprovisationObjectMock = internalCache.ImprovisationComponentData.get as jest.Mock

const OBJECT_ID = 'OBJECT#Tray'
const perspective: any = { assetStack: ['ASSET#Canon'] }

describe('ensureObjectShortNameCacheRecord', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getExactMatchMock.mockResolvedValue(null)
        putCacheRecordMock.mockResolvedValue('CACHE#new-uuid')
    })

    it('writes a fresh cache row from the merged shortName, no existing row to overwrite', async () => {
        shortNameFromMergedAggregateMock.mockResolvedValue('serving tray')

        await ensureObjectShortNameCacheRecord({ componentId: OBJECT_ID as any, perspective })

        expect(putCacheRecordMock).toHaveBeenCalledWith(
            OBJECT_ID,
            {
                markState: { markValue: [] },
                renderedContent: { displayName: ['serving tray'], description: [] },
                provenance: { type: EPHEMERA_CACHE_PROVENANCE_AUTHORED },
                perspectiveId: expect.any(String),
                perspectiveMatcher: { requiredAssetIds: ['ASSET#Canon'], forbiddenAssetIds: [] },
            },
            undefined
        )
    })

    it('overwrites an existing row in place rather than accumulating a new one', async () => {
        shortNameFromMergedAggregateMock.mockResolvedValue('serving tray')
        getExactMatchMock.mockResolvedValue({ DataCategory: 'CACHE#existing-uuid' })

        await ensureObjectShortNameCacheRecord({ componentId: OBJECT_ID as any, perspective })

        expect(putCacheRecordMock).toHaveBeenCalledWith(
            OBJECT_ID,
            expect.anything(),
            'CACHE#existing-uuid'
        )
    })

    it('falls back to the improvisation component shortName when the merged aggregate has none', async () => {
        shortNameFromMergedAggregateMock.mockResolvedValue(undefined)
        getImprovisationObjectMock.mockResolvedValue({ component: 'fake-component' })
        shortNameFromComponentMock.mockReturnValue('improv gizmo')

        await ensureObjectShortNameCacheRecord({ componentId: OBJECT_ID as any, perspective })

        expect(putCacheRecordMock).toHaveBeenCalledWith(
            OBJECT_ID,
            expect.objectContaining({ renderedContent: { displayName: ['improv gizmo'], description: [] } }),
            undefined
        )
    })

    it('throws when no shortName can be resolved from either source', async () => {
        shortNameFromMergedAggregateMock.mockResolvedValue(undefined)
        getImprovisationObjectMock.mockResolvedValue(undefined)
        shortNameFromComponentMock.mockReturnValue(undefined)

        await expect(
            ensureObjectShortNameCacheRecord({ componentId: OBJECT_ID as any, perspective })
        ).rejects.toThrow(/could not resolve a shortName/)
        expect(putCacheRecordMock).not.toHaveBeenCalled()
    })

    it('throws when given a non-Object componentId', async () => {
        await expect(
            ensureObjectShortNameCacheRecord({ componentId: 'ROOM#Cafe' as any, perspective })
        ).rejects.toThrow(/not an Object id/)
    })
})
