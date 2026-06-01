import type { AuthoredExample } from '../../assets/components/componentExamples'
import { authoredExampleSetFromEntries } from '../../assets/components/componentExamples'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import { classifyAuthoredCatalogDrift } from './classifyAuthoredCatalogDrift'
import {
    getCatalogRow,
    queryCacheRowsForComponent,
    queryCatalogRowsForComponent,
    type EphemeraRenderCacheReadDB,
} from './fetch'
import { createRenderCacheCacheHandler } from './factory'
import type { EphemeraCacheCatalogRow, EphemeraCacheDynamoItem } from './types'

const componentId = 'ROOM#room' as const
const perspectiveKey = 'PERSPECTIVE#v1#abc'
const perspective: Perspective = { assetStack: ['ASSET#a'] }

const minimalRecord = {
    markState: { markValue: [{ mark: 'MARK#mark-uuid', value: 'sunny' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' as const },
    perspectiveId: perspectiveKey,
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] },
}

const makeRow = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
    EphemeraId: componentId,
    DataCategory: 'CACHE#existing',
    markState: minimalRecord.markState,
    renderedContent: minimalRecord.renderedContent,
    provenance: minimalRecord.provenance,
    perspectiveId: perspectiveKey,
    perspectiveMatcher: { requiredAssetIds: ['ASSET#a'], forbiddenAssetIds: [] } as EphemeraCacheDynamoItem['perspectiveMatcher'],
    situationId: 'SITUATION#one',
    catalogVersion: 1,
    ...overrides,
})

const readyCatalog = (overrides: Partial<EphemeraCacheCatalogRow> = {}): EphemeraCacheCatalogRow => ({
    EphemeraId: componentId,
    DataCategory: `Cache::${perspectiveKey}`,
    assetStack: ['ASSET#a'],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
    ...overrides,
})

const example = (situationId: string): AuthoredExample => ({
    situationId: situationId as AuthoredExample['situationId'],
    markState: minimalRecord.markState,
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
})

describe('renderCache fetch', () => {
    it('queryCacheRowsForComponent filters invalid rows', async () => {
        const valid = {
            EphemeraId: componentId,
            DataCategory: 'CACHE#valid',
            ...minimalRecord,
        }
        const db: EphemeraRenderCacheReadDB = {
            query: jest.fn().mockResolvedValue([
                valid,
                { EphemeraId: componentId, DataCategory: 'OTHER#x' },
                { EphemeraId: componentId, DataCategory: 'CACHE#bad', markState: null },
            ]),
            getItem: jest.fn(),
        }

        const result = await queryCacheRowsForComponent(db, componentId)

        expect(db.query).toHaveBeenCalledWith({
            Key: { EphemeraId: componentId },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: { ':dcPrefix': 'CACHE#' },
            allFields: true,
        })
        expect(result).toEqual([valid])
    })

    it('queryCatalogRowsForComponent filters invalid rows', async () => {
        const valid = readyCatalog()
        const db: EphemeraRenderCacheReadDB = {
            query: jest.fn().mockResolvedValue([
                valid,
                { EphemeraId: componentId, DataCategory: 'Cache::bad', assetStack: [] },
            ]),
            getItem: jest.fn(),
        }

        const result = await queryCatalogRowsForComponent(db, componentId)

        expect(result).toEqual([valid])
    })

    it('getCatalogRow returns undefined for invalid shape', async () => {
        const db: EphemeraRenderCacheReadDB = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue({ EphemeraId: componentId, DataCategory: 'Cache::x' }),
        }

        const result = await getCatalogRow(db, componentId, perspectiveKey)

        expect(result).toBeUndefined()
    })
})

describe('RenderCacheCacheHandler memo', () => {
    const makeHandler = (rows: EphemeraCacheDynamoItem[] = [makeRow()]) => {
        const db: EphemeraRenderCacheReadDB = {
            query: jest.fn().mockImplementation(async (props) => {
                if (props.ExpressionAttributeValues?.[':dcPrefix'] === 'CACHE#') {
                    return rows
                }
                return []
            }),
            getItem: jest.fn(),
        }
        return { handler: createRenderCacheCacheHandler(db), db }
    }

    it('memoizes sequential getCacheRows calls', async () => {
        const { handler, db } = makeHandler()
        const a1 = await handler.getCacheRows(componentId)
        const a2 = await handler.get(componentId)
        expect(db.query).toHaveBeenCalledTimes(1)
        expect(a1).toBe(a2)
    })

    it('set with cacheId replaces matching DataCategory', async () => {
        const { handler } = makeHandler([makeRow({ DataCategory: 'CACHE#keep-me' })])
        await handler.getCacheRows(componentId)

        handler.set({
            componentId,
            cacheId: 'CACHE#keep-me',
            markState: { markValue: [{ mark: 'MARK#b', value: 'two' }] },
            renderedContent: { description: [] },
            provenance: { type: 'generated' },
            perspectiveId: perspectiveKey,
            perspectiveMatcher: { requiredAssetIds: ['ASSET#b'], forbiddenAssetIds: [] },
        })

        const rows = await handler.getCacheRows(componentId)
        expect(rows).toHaveLength(1)
        expect(rows[0].provenance.type).toBe('generated')
    })

    it('deleteCacheRecords mutates memo in place', async () => {
        const { handler } = makeHandler([
            makeRow({ DataCategory: 'CACHE#keep' }),
            makeRow({ DataCategory: 'CACHE#drop' }),
        ])
        const rows = await handler.getCacheRows(componentId)
        handler.deleteCacheRecords(componentId, ['CACHE#drop'])
        expect(rows).toHaveLength(1)
        expect(rows[0].DataCategory).toBe('CACHE#keep')
    })

    it('setCatalogRow serves memoized row after prior miss without second getItem', async () => {
        const catalog = readyCatalog({ hydratedCatalogVersion: 0 })
        const db: EphemeraRenderCacheReadDB = {
            query: jest.fn().mockResolvedValue([]),
            getItem: jest.fn().mockResolvedValueOnce(undefined),
        }
        const handler = createRenderCacheCacheHandler(db)

        const first = await handler.getCatalogRow(componentId, perspectiveKey)
        expect(first).toBeUndefined()
        expect(db.getItem).toHaveBeenCalledTimes(1)

        handler.setCatalogRow({ row: catalog })

        const second = await handler.getCatalogRow(componentId, perspectiveKey)
        expect(second).toEqual(catalog)
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('setCatalogRow updates catalog list and single-key memo', async () => {
        const initial = readyCatalog()
        const db: EphemeraRenderCacheReadDB = {
            query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([initial]),
            getItem: jest.fn().mockResolvedValueOnce(initial),
        }
        const handler = createRenderCacheCacheHandler(db)

        await handler.getCatalogRows(componentId)
        await handler.getCatalogRow(componentId, perspectiveKey)

        const updated = readyCatalog({ catalogVersion: 2, hydratedCatalogVersion: 2 })
        handler.setCatalogRow({ row: updated })

        expect(await handler.getCatalogRow(componentId, perspectiveKey)).toEqual(updated)
        expect(await handler.getCatalogRows(componentId)).toEqual([updated])
        expect(db.getItem).toHaveBeenCalledTimes(1)
        expect(db.query).toHaveBeenCalledTimes(1)
    })

    it('setCatalogRow does not invalidate CACHE# memo', async () => {
        const { handler, db } = makeHandler([makeRow()])
        const rowsBefore = await handler.getCacheRows(componentId)
        const queryCallsBefore = (db.query as jest.Mock).mock.calls.length

        handler.setCatalogRow({ row: readyCatalog() })

        const rowsAfter = await handler.getCacheRows(componentId)
        expect(rowsAfter).toBe(rowsBefore)
        expect(db.query).toHaveBeenCalledTimes(queryCallsBefore)
    })

    it('invalidate clears cache rows and catalog memo', async () => {
        const catalog = readyCatalog()
        const db: EphemeraRenderCacheReadDB = {
            query: jest.fn()
                .mockResolvedValueOnce([makeRow()])
                .mockResolvedValueOnce([catalog])
                .mockResolvedValueOnce([makeRow({ DataCategory: 'CACHE#after' })])
                .mockResolvedValueOnce([catalog]),
            getItem: jest.fn().mockResolvedValueOnce(catalog).mockResolvedValueOnce(undefined),
        }
        const handler = createRenderCacheCacheHandler(db)

        await handler.getCacheRows(componentId)
        await handler.getCatalogRows(componentId)
        await handler.getCatalogRow(componentId, perspectiveKey)
        handler.invalidate(componentId)

        const rows = await handler.getCacheRows(componentId)
        const catalogs = await handler.getCatalogRows(componentId)
        const single = await handler.getCatalogRow(componentId, perspectiveKey)

        expect(db.query).toHaveBeenCalledTimes(4)
        expect(db.getItem).toHaveBeenCalledTimes(2)
        expect(rows[0].DataCategory).toBe('CACHE#after')
        expect(catalogs).toEqual([catalog])
        expect(single).toBeUndefined()
    })
})

describe('classifyAuthoredCatalogDrift', () => {
    it('returns missing when catalog is stale', () => {
        const result = classifyAuthoredCatalogDrift({
            catalogRow: readyCatalog({ catalogVersion: 2, hydratedCatalogVersion: 1 }),
            desiredSet: authoredExampleSetFromEntries([['SITUATION#one', example('SITUATION#one')]]),
            materializedRows: [makeRow({ catalogVersion: 2 })],
            perspective,
        })
        expect(result).toEqual({ status: 'missing' })
    })

    it('returns corrupted when desired slice is absent from materialized rows', () => {
        const result = classifyAuthoredCatalogDrift({
            catalogRow: readyCatalog(),
            desiredSet: authoredExampleSetFromEntries([
                ['SITUATION#one', example('SITUATION#one')],
                ['SITUATION#two', example('SITUATION#two')],
            ]),
            materializedRows: [makeRow({ situationId: 'SITUATION#one', catalogVersion: 1 })],
            perspective,
        })
        expect(result).toEqual({ status: 'corrupted' })
    })

    it('returns corrupted when extra materialized slice is absent from desired set', () => {
        const result = classifyAuthoredCatalogDrift({
            catalogRow: readyCatalog(),
            desiredSet: authoredExampleSetFromEntries([['SITUATION#one', example('SITUATION#one')]]),
            materializedRows: [
                makeRow({ situationId: 'SITUATION#one', catalogVersion: 1 }),
                makeRow({ situationId: 'SITUATION#extra', DataCategory: 'CACHE#extra', catalogVersion: 1 }),
            ],
            perspective,
        })
        expect(result).toEqual({ status: 'corrupted' })
    })

    it('returns aligned when blueprint matches authoritative materialized rows', () => {
        const result = classifyAuthoredCatalogDrift({
            catalogRow: readyCatalog(),
            desiredSet: authoredExampleSetFromEntries([['SITUATION#one', example('SITUATION#one')]]),
            materializedRows: [makeRow({ situationId: 'SITUATION#one', catalogVersion: 1 })],
            perspective,
        })
        expect(result).toEqual({ status: 'aligned' })
    })

    it('ignores non-authoritative version rows when classifying', () => {
        const result = classifyAuthoredCatalogDrift({
            catalogRow: readyCatalog({ catalogVersion: 2, hydratedCatalogVersion: 2 }),
            desiredSet: authoredExampleSetFromEntries([['SITUATION#one', example('SITUATION#one')]]),
            materializedRows: [
                makeRow({ situationId: 'SITUATION#one', catalogVersion: 1, DataCategory: 'CACHE#stale' }),
                makeRow({ situationId: 'SITUATION#one', catalogVersion: 2, DataCategory: 'CACHE#current' }),
            ],
            perspective,
        })
        expect(result).toEqual({ status: 'aligned' })
    })
})
