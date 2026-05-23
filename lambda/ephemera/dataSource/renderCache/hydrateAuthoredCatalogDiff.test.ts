jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        RenderCache: {
            deleteCacheRecords: jest.fn(),
        },
    },
}))

import type { AuthoredExample } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import { authoredExampleSetFromEntries } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import internalCache from '../../internalCache'
import type { EphemeraCacheDynamoItem } from './baseClasses'
import { deleteCacheRecord } from './deleteCacheRecord'
import { hydrateAuthoredCatalogDiff } from './hydrateAuthoredCatalogDiff'
import { putCacheRecord } from './putCacheRecord'
import { queryCacheRecordsForComponent } from './queryCacheRecordsForComponent'
import { deleteAdjacencyForRemovedSlice, upsertAdjacencyForAuthoredSlice } from './situationAdjacency'

jest.mock('./queryCacheRecordsForComponent')
jest.mock('./putCacheRecord')
jest.mock('./deleteCacheRecord')
jest.mock('./situationAdjacency')

const queryMock = queryCacheRecordsForComponent as jest.MockedFunction<typeof queryCacheRecordsForComponent>
const putMock = putCacheRecord as jest.MockedFunction<typeof putCacheRecord>
const deleteMock = deleteCacheRecord as jest.MockedFunction<typeof deleteCacheRecord>
const upsertAdjacencyMock = upsertAdjacencyForAuthoredSlice as jest.MockedFunction<
    typeof upsertAdjacencyForAuthoredSlice
>
const deleteAdjacencyMock = deleteAdjacencyForRemovedSlice as jest.MockedFunction<
    typeof deleteAdjacencyForRemovedSlice
>

const componentId = 'ROOM#room' as const
const perspective: Perspective = { assetStack: ['ASSET#a'] }
const perspectiveKey = 'PERSPECTIVE#v1#abc'

const example = (situationId: string): AuthoredExample => ({
    situationId: situationId as AuthoredExample['situationId'],
    markState: { markValue: [{ mark: 'MARK#m', value: 'v' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
})

const authoredRow = (
    overrides: Partial<EphemeraCacheDynamoItem> = {}
): EphemeraCacheDynamoItem => ({
    EphemeraId: componentId,
    DataCategory: 'CACHE#one',
    markState: example('SITUATION#one').markState,
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
    perspectiveId: perspectiveKey,
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] },
    situationId: 'SITUATION#one',
    ...overrides,
})

describe('hydrateAuthoredCatalogDiff', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        putMock.mockResolvedValue('CACHE#written')
    })

    it('deletes authored rows absent from desired set when version-guarded', async () => {
        queryMock.mockResolvedValue([
            authoredRow({ situationId: 'SITUATION#gone', DataCategory: 'CACHE#gone', catalogVersion: 1 }),
        ])

        await hydrateAuthoredCatalogDiff({
            componentId,
            perspective,
            perspectiveKey,
            assetStack: ['ASSET#a'],
            incomingCatalogVersion: 2,
            desiredSet: authoredExampleSetFromEntries([]),
        })

        expect(deleteMock).toHaveBeenCalledWith(componentId, 'CACHE#gone')
        expect(deleteAdjacencyMock).toHaveBeenCalledWith(
            expect.objectContaining({ situationId: 'SITUATION#gone' })
        )
        expect(internalCache.RenderCache.deleteCacheRecords).toHaveBeenCalledWith(componentId, ['CACHE#gone'])
    })

    it('upserts every desired slice at incoming catalog version', async () => {
        queryMock.mockResolvedValue([])

        await hydrateAuthoredCatalogDiff({
            componentId,
            perspective,
            perspectiveKey,
            assetStack: ['ASSET#a'],
            incomingCatalogVersion: 2,
            desiredSet: authoredExampleSetFromEntries([
                ['SITUATION#one', example('SITUATION#one')],
            ]),
        })

        expect(putMock).toHaveBeenCalledWith(
            componentId,
            expect.objectContaining({ catalogVersion: 2, situationId: 'SITUATION#one' }),
            undefined
        )
        expect(upsertAdjacencyMock).toHaveBeenCalled()
    })

    it('skips upsert when existing row is already at or above incoming version', async () => {
        queryMock.mockResolvedValue([
            authoredRow({ catalogVersion: 2, DataCategory: 'CACHE#keep' }),
        ])

        await hydrateAuthoredCatalogDiff({
            componentId,
            perspective,
            perspectiveKey,
            assetStack: ['ASSET#a'],
            incomingCatalogVersion: 2,
            desiredSet: authoredExampleSetFromEntries([
                ['SITUATION#one', example('SITUATION#one')],
            ]),
        })

        expect(putMock).not.toHaveBeenCalled()
    })

    it('does not delete rows at or above incoming catalog version when absent from desired set', async () => {
        queryMock.mockResolvedValue([
            authoredRow({
                situationId: 'SITUATION#gone',
                DataCategory: 'CACHE#gone',
                catalogVersion: 2,
            }),
        ])

        await hydrateAuthoredCatalogDiff({
            componentId,
            perspective,
            perspectiveKey,
            assetStack: ['ASSET#a'],
            incomingCatalogVersion: 2,
            desiredSet: authoredExampleSetFromEntries([]),
        })

        expect(deleteMock).not.toHaveBeenCalled()
        expect(deleteAdjacencyMock).not.toHaveBeenCalled()
    })

    it('does not delete authored rows for a different perspective', async () => {
        queryMock.mockResolvedValue([
            authoredRow({
                situationId: 'SITUATION#gone',
                DataCategory: 'CACHE#otherPerspective',
                catalogVersion: 1,
                perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] },
            }),
        ])

        await hydrateAuthoredCatalogDiff({
            componentId,
            perspective,
            perspectiveKey,
            assetStack: ['ASSET#a'],
            incomingCatalogVersion: 2,
            desiredSet: authoredExampleSetFromEntries([]),
        })

        expect(deleteMock).not.toHaveBeenCalled()
    })

    it('upserts adjacency once per desired situation slice', async () => {
        queryMock.mockResolvedValue([])

        await hydrateAuthoredCatalogDiff({
            componentId,
            perspective,
            perspectiveKey,
            assetStack: ['ASSET#a'],
            incomingCatalogVersion: 2,
            desiredSet: authoredExampleSetFromEntries([
                ['SITUATION#one', example('SITUATION#one')],
                ['SITUATION#two', example('SITUATION#two')],
            ]),
        })

        expect(putMock).toHaveBeenCalledTimes(2)
        expect(upsertAdjacencyMock).toHaveBeenCalledTimes(2)
        expect(upsertAdjacencyMock).toHaveBeenCalledWith(
            expect.objectContaining({ situationId: 'SITUATION#one' })
        )
        expect(upsertAdjacencyMock).toHaveBeenCalledWith(
            expect.objectContaining({ situationId: 'SITUATION#two' })
        )
    })
})
