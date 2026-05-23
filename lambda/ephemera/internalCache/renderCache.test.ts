jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        query: jest.fn(),
        getItem: jest.fn(),
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { RenderCacheData } from './renderCache'
import type { EphemeraCacheDynamoItem } from '../dataSource/renderCache/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const roomId = 'ROOM#r1' as const

const makeRow = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
    EphemeraId: roomId,
    DataCategory: 'CACHE#existing',
    markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
    perspectiveId: 'PERSPECTIVE#p1',
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] },
    ...overrides,
})

describe('RenderCacheData', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(ephemeraDBMock.getItem as jest.Mock).mockResolvedValue(undefined)
        ;(ephemeraDBMock.query as jest.Mock).mockResolvedValue([])
    })

    const makeCache = (rows: EphemeraCacheDynamoItem[] = [makeRow()]) => {
        ;(ephemeraDBMock.query as jest.Mock).mockResolvedValue(rows)
        return new RenderCacheData()
    }

    describe('contract', () => {
        it('memoizes sequential get calls per componentId (single query)', async () => {
            const cache = makeCache([makeRow()])
            const a1 = await cache.get(roomId)
            const a2 = await cache.get(roomId)

            expect(ephemeraDBMock.query).toHaveBeenCalledTimes(1)
            expect(a1).toBe(a2)
        })

        it('set with cacheId replaces matching DataCategory', async () => {
            const cache = makeCache([makeRow({ DataCategory: 'CACHE#keep-me' })])
            await cache.get(roomId)

            cache.set({
                componentId: roomId,
                cacheId: 'CACHE#keep-me',
                markState: { markValue: [{ mark: 'MARK#b', value: 'two' }] },
                renderedContent: { description: [] },
                provenance: { type: 'generated' },
                perspectiveId: 'PERSPECTIVE#p2',
                perspectiveMatcher: { requiredAssetIds: ['ASSET#b'], forbiddenAssetIds: [] },
            })

            const rows = await cache.get(roomId)
            expect(rows).toHaveLength(1)
            expect(rows[0].DataCategory).toBe('CACHE#keep-me')
            expect(rows[0].markState.markValue[0]).toEqual({ mark: 'MARK#b', value: 'two' })
            expect(rows[0].perspectiveMatcher.requiredAssetIds).toEqual(['ASSET#b'])
        })

        it('set with cacheId appends when key not in list', async () => {
            const cache = makeCache([makeRow({ DataCategory: 'CACHE#old' })])
            const rows = await cache.get(roomId)

            cache.set({
                componentId: roomId,
                cacheId: 'CACHE#brand-new',
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#x',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            })

            expect(rows).toHaveLength(2)
            expect(rows.map((r) => r.DataCategory).sort()).toEqual(['CACHE#brand-new', 'CACHE#old'].sort())
        })

        it('set with invalid cacheId prefix is a no-op', async () => {
            const initial = makeRow()
            const cache = makeCache([initial])
            const rows = await cache.get(roomId)

            cache.set({
                componentId: roomId,
                cacheId: 'NOT_CACHE#x',
                markState: { markValue: [] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#x',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            })

            expect(rows).toEqual([initial])
        })

        it('set without cacheId replaces row with equal markState', async () => {
            const markState = { markValue: [{ mark: 'MARK#a', value: 'one' }] }
            const cache = makeCache([makeRow({ markState })])
            await cache.get(roomId)

            cache.set({
                componentId: roomId,
                markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
                renderedContent: { description: [] },
                provenance: { type: 'generated' },
                perspectiveId: 'PERSPECTIVE#p1',
                perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] },
            })

            const rows = await cache.get(roomId)
            expect(rows).toHaveLength(1)
            expect(rows[0].DataCategory).toBe('CACHE#existing')
            expect(rows[0].provenance.type).toBe('generated')
        })

        it('set without cacheId appends when no markState match', async () => {
            const cache = makeCache([makeRow()])
            const rows = await cache.get(roomId)

            cache.set({
                componentId: roomId,
                markState: { markValue: [{ mark: 'MARK#z', value: 'other' }] },
                renderedContent: { description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'PERSPECTIVE#z',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            })

            expect(rows).toHaveLength(2)
            const categories = rows.map((r) => r.DataCategory)
            expect(categories.every((c) => c.startsWith('CACHE#'))).toBe(true)
        })

        it('deleteCacheRecords removes matching rows from a loaded component memo', async () => {
            const cache = makeCache([
                makeRow({ DataCategory: 'CACHE#keep' }),
                makeRow({ DataCategory: 'CACHE#drop' }),
            ])
            const rows = await cache.get(roomId)

            cache.deleteCacheRecords(roomId, ['CACHE#drop'])

            expect(rows).toHaveLength(1)
            expect(rows[0].DataCategory).toBe('CACHE#keep')
        })

        it('deleteCacheRecords on unloaded component is a no-op', async () => {
            const cache = makeCache([makeRow()])

            cache.deleteCacheRecords(roomId, ['CACHE#drop'])

            expect(ephemeraDBMock.query).not.toHaveBeenCalled()
        })

        it('invalidate drops memo so next get queries again', async () => {
            const query = jest.fn()
                .mockResolvedValueOnce([makeRow()])
                .mockResolvedValueOnce([makeRow({ DataCategory: 'CACHE#after' })])
            ;(ephemeraDBMock.query as jest.Mock).mockImplementation(query)
            const cache = new RenderCacheData()
            await cache.get(roomId)
            cache.invalidate(roomId)
            const rows = await cache.get(roomId)
            expect(query).toHaveBeenCalledTimes(2)
            expect(rows[0]?.DataCategory).toBe('CACHE#after')
        })

        it('set before get initializes authoritative write state', async () => {
            const cache = makeCache([makeRow()])

            cache.set({
                componentId: roomId,
                markState: { markValue: [{ mark: 'MARK#x', value: 'y' }] },
                renderedContent: { description: [] },
                provenance: { type: 'generated' },
                perspectiveId: 'PERSPECTIVE#new',
                perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            })

            const rows = await cache.get(roomId)
            expect(rows).toHaveLength(1)
            expect(rows[0].perspectiveId).toBe('PERSPECTIVE#new')
        })

        it('overlapping get calls dedupe to one query invocation', async () => {
            let releaseQuery: () => void = () => {}
            const queryBarrier = new Promise<void>((resolve) => {
                releaseQuery = resolve
            })
            ;(ephemeraDBMock.query as jest.Mock).mockImplementation(async () => {
                await queryBarrier
                return [makeRow()]
            })
            const cache = new RenderCacheData()

            const first = cache.get(roomId)
            const second = cache.get(roomId)
            releaseQuery()

            const [rowsOne, rowsTwo] = await Promise.all([first, second])
            expect(ephemeraDBMock.query).toHaveBeenCalledTimes(1)
            expect(rowsOne).toBe(rowsTwo)
        })
    })

    describe('mustRemainStable', () => {
        describe('getExactMatch', () => {
            const perspective: Perspective = { assetStack: ['ASSET#a'] }

            it('returns a record when markState and perspective match', async () => {
                const row = makeRow()
                const cache = makeCache([row])

                const result = await cache.getExactMatch({
                    componentId: roomId,
                    proposedMarkState: row.markState,
                    perspective,
                })

                expect(result).not.toBeNull()
                expect(result).toEqual(expect.objectContaining({ DataCategory: row.DataCategory }))
            })

            it('returns null when markState mismatches', async () => {
                const row = makeRow()
                const cache = makeCache([row])

                const result = await cache.getExactMatch({
                    componentId: roomId,
                    proposedMarkState: { markValue: [{ mark: 'MARK#a', value: 'different' }] },
                    perspective,
                })

                expect(result).toBeNull()
            })

            it('returns null when perspective mismatches', async () => {
                const row = makeRow({ perspectiveMatcher: { requiredAssetIds: ['ASSET#other'], forbiddenAssetIds: [] } })
                const cache = makeCache([row])

                const result = await cache.getExactMatch({
                    componentId: roomId,
                    proposedMarkState: row.markState,
                    perspective,
                })

                expect(result).toBeNull()
            })

            it('memoizes get(componentId) so query runs once', async () => {
                const row = makeRow()
                const cache = makeCache([row])

                const a = await cache.getExactMatch({
                    componentId: roomId,
                    proposedMarkState: row.markState,
                    perspective,
                })
                const b = await cache.getExactMatch({
                    componentId: roomId,
                    proposedMarkState: { markValue: [{ mark: 'MARK#a', value: 'different' }] },
                    perspective,
                })

                expect(a).not.toBeNull()
                expect(b).toBeNull()
                expect(ephemeraDBMock.query).toHaveBeenCalledTimes(1)
            })

            it('ignores stale-version rows when catalog exists', async () => {
                ;(ephemeraDBMock.getItem as jest.Mock).mockResolvedValue({
                    EphemeraId: roomId,
                    DataCategory: 'Cache::PERSPECTIVE#v1#x',
                    assetStack: ['ASSET#a'],
                    catalogVersion: 2,
                    hydratedCatalogVersion: 2,
                })
                const stale = makeRow({ catalogVersion: 1, DataCategory: 'CACHE#stale' })
                const current = makeRow({ catalogVersion: 2, DataCategory: 'CACHE#current' })
                const cache = makeCache([stale, current])

                const result = await cache.getExactMatch({
                    componentId: roomId,
                    proposedMarkState: current.markState,
                    perspective,
                })

                expect(result?.DataCategory).toBe('CACHE#current')
            })
        })
    })
})
