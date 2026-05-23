import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { EventBridgeClient } from '@aws-sdk/client-eventbridge'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { authoredExampleSetFromEntries } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import type { AuthoredExample } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import type { ComponentExamplesMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples/factory'
import type { EphemeraCacheCatalogRow, EphemeraCacheDynamoItem } from '@tonylb/mtw-gateways/ts/ephemera/renderCache'
import type { RenderCacheCacheHandler } from '@tonylb/mtw-gateways/ts/ephemera/renderCache/factory'
import type { EphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        RenderCache: {
            getCatalogRows: jest.fn(),
            getCacheRows: jest.fn(),
        },
        ComponentExamples: {
            get: jest.fn(),
        },
    },
}))

import internalCache from '../internalCache'
import { renderCacheDriftSweep } from './index'

const roomId = 'ROOM#hall' as const
const perspectiveKey = 'PERSPECTIVE#v1#abc'

const assetA = 'ASSET#a' as AssetUUID

const minimalRecord = {
    markState: { markValue: [{ mark: 'MARK#mark-uuid', value: 'sunny' }] },
    renderedContent: { description: [] },
    provenance: { type: 'authored' as const },
    perspectiveId: perspectiveKey,
    perspectiveMatcher: { requiredAssetIds: [assetA], forbiddenAssetIds: [] as AssetUUID[] },
}

const readyCatalog = (overrides: Partial<EphemeraCacheCatalogRow> = {}): EphemeraCacheCatalogRow => ({
    EphemeraId: roomId,
    DataCategory: `Cache::${perspectiveKey}` as EphemeraCacheCatalogRow['DataCategory'],
    assetStack: [assetA],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
    ...overrides,
})

const makeRow = (overrides: Partial<EphemeraCacheDynamoItem> = {}): EphemeraCacheDynamoItem => ({
    EphemeraId: roomId,
    DataCategory: 'CACHE#existing',
    markState: minimalRecord.markState,
    renderedContent: minimalRecord.renderedContent,
    provenance: minimalRecord.provenance,
    perspectiveId: perspectiveKey,
    perspectiveMatcher: minimalRecord.perspectiveMatcher as EphemeraCacheDynamoItem['perspectiveMatcher'],
    situationId: 'SITUATION#one',
    catalogVersion: 1,
    ...overrides,
})

const example = (situationId: string): AuthoredExample => ({
    situationId: situationId as AuthoredExample['situationId'],
    markState: minimalRecord.markState,
    renderedContent: { description: [] },
    provenance: { type: 'authored' },
})

describe('renderCacheDriftSweep', () => {
    const ebSend = jest.spyOn(EventBridgeClient.prototype, 'send') as jest.Mock
    const getCatalogRows = internalCache.RenderCache.getCatalogRows as jest.MockedFunction<
        RenderCacheCacheHandler['getCatalogRows']
    >
    const getCacheRows = internalCache.RenderCache.getCacheRows as jest.MockedFunction<
        RenderCacheCacheHandler['getCacheRows']
    >
    const componentExamplesGet = internalCache.ComponentExamples.get as jest.MockedFunction<
        ComponentExamplesMergedCache['get']
    >

    beforeEach(() => {
        ebSend.mockReset()
        getCatalogRows.mockReset()
        getCacheRows.mockReset()
        componentExamplesGet.mockReset()
        process.env.EVENT_BUS_NAME = 'test-bus'
        process.env.AWS_REGION = 'us-east-1'
    })

    it('no-ops without reads when roomIds is empty', async () => {
        const result = await renderCacheDriftSweep({ roomIds: [] })

        expect(result).toEqual({
            emittedCount: 0,
            roomIds: [],
            catalogsChecked: 0,
            driftedCatalogs: [],
        })
        expect(getCatalogRows).not.toHaveBeenCalled()
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('no-ops when roomIds is missing', async () => {
        const result = await renderCacheDriftSweep()

        expect(result.emittedCount).toBe(0)
        expect(getCatalogRows).not.toHaveBeenCalled()
    })

    it('skips invalid room ids and dedupes', async () => {
        getCatalogRows.mockResolvedValue([])

        const result = await renderCacheDriftSweep({
            roomIds: ['ROOM#a', 'not-a-room', 'ROOM#a'],
        })

        expect(result.roomIds).toEqual(['ROOM#a'])
        expect(getCatalogRows).toHaveBeenCalledTimes(1)
        expect(getCatalogRows).toHaveBeenCalledWith('ROOM#a')
    })

    it('does not emit when catalog is aligned', async () => {
        getCatalogRows.mockResolvedValue([readyCatalog()])
        getCacheRows.mockResolvedValue([makeRow()])
        componentExamplesGet.mockResolvedValue(
            authoredExampleSetFromEntries([['SITUATION#one', example('SITUATION#one')]])
        )

        const result = await renderCacheDriftSweep({ roomIds: [roomId] })

        expect(result.emittedCount).toBe(0)
        expect(result.catalogsChecked).toBe(1)
        expect(ebSend).not.toHaveBeenCalled()
    })

    it('emits missing finding when catalog row is stale', async () => {
        getCatalogRows.mockResolvedValue([
            readyCatalog({ catalogVersion: 2, hydratedCatalogVersion: 1 }),
        ])
        getCacheRows.mockResolvedValue([makeRow({ catalogVersion: 2 })])
        componentExamplesGet.mockResolvedValue(
            authoredExampleSetFromEntries([['SITUATION#one', example('SITUATION#one')]])
        )
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await renderCacheDriftSweep({
            roomIds: [roomId],
            diagnosticRunId: 'run-missing',
            nowMs: 1000,
        })

        expect(result.emittedCount).toBe(1)
        expect(result.driftedCatalogs).toEqual([
            { ephemeraId: roomId, perspectiveKey },
        ])
        expect(ebSend).toHaveBeenCalledTimes(1)
        const putInput = ebSend.mock.calls[0][0] as { input: { Entries: { Detail: string }[] } }
        const detail = JSON.parse(putInput.input.Entries[0].Detail)
        expect(detail.type).toBe('Ephemera RenderCache Finding')
        expect(detail.status).toBe('missing')
        expect(detail.targetCatalogs).toEqual([{ ephemeraId: roomId, perspectiveKey }])
        expect(detail.roomIds).toBeUndefined()
        expect(detail.perspective).toBeUndefined()
    })

    it('emits corrupted finding when blueprint does not match materialized rows', async () => {
        getCatalogRows.mockResolvedValue([readyCatalog()])
        getCacheRows.mockResolvedValue([makeRow({ situationId: 'SITUATION#one', catalogVersion: 1 })])
        componentExamplesGet.mockResolvedValue(
            authoredExampleSetFromEntries([
                ['SITUATION#one', example('SITUATION#one')],
                ['SITUATION#two', example('SITUATION#two')],
            ])
        )
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await renderCacheDriftSweep({ roomIds: [roomId] })

        expect(result.emittedCount).toBe(1)
        expect(result.driftedCatalogs).toEqual([
            { ephemeraId: roomId, perspectiveKey },
        ])
        expect(ebSend).toHaveBeenCalledTimes(1)
        const putInput = ebSend.mock.calls[0][0] as { input: { Entries: { Detail: string }[] } }
        const detail = JSON.parse(putInput.input.Entries[0].Detail)
        expect(detail.status).toBe('corrupted')
    })

    it('emits two findings when catalogs have mixed missing and corrupted drift', async () => {
        const perspectiveKeyB = 'PERSPECTIVE#v1#def'
        getCatalogRows.mockResolvedValue([
            readyCatalog({ catalogVersion: 2, hydratedCatalogVersion: 1 }),
            readyCatalog({
                DataCategory: `Cache::${perspectiveKeyB}` as EphemeraCacheCatalogRow['DataCategory'],
                catalogVersion: 1,
                hydratedCatalogVersion: 1,
            }),
        ])
        getCacheRows.mockResolvedValue([
            makeRow({ catalogVersion: 2 }),
            makeRow({
                situationId: 'SITUATION#one',
                catalogVersion: 1,
                perspectiveMatcher: {
                    requiredAssetIds: [assetA],
                    forbiddenAssetIds: [] as AssetUUID[],
                },
            }),
        ])
        componentExamplesGet
            .mockResolvedValueOnce(
                authoredExampleSetFromEntries([['SITUATION#one', example('SITUATION#one')]])
            )
            .mockResolvedValueOnce(
                authoredExampleSetFromEntries([
                    ['SITUATION#one', example('SITUATION#one')],
                    ['SITUATION#two', example('SITUATION#two')],
                ])
            )
        ebSend.mockResolvedValue({ FailedEntryCount: 0 } as never)

        const result = await renderCacheDriftSweep({ roomIds: [roomId] })

        expect(result.emittedCount).toBe(2)
        expect(result.catalogsChecked).toBe(2)
        expect(ebSend).toHaveBeenCalledTimes(2)
        const statuses = ebSend.mock.calls.map((call) => {
            const putInput = call[0] as { input: { Entries: { Detail: string }[] } }
            return JSON.parse(putInput.input.Entries[0].Detail).status
        })
        expect(statuses.sort()).toEqual(['corrupted', 'missing'])
    })
})
