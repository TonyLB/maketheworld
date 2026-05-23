jest.mock('../renderCache/catalogRow', () => ({
    getCatalogRow: jest.fn(),
}))

import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { getCatalogRow } from '../renderCache/catalogRow'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { perspectiveMatches, computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { markStatesEqual } from '../renderCache/utils/markState'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION, type RenderResolveInputSuccess } from './baseClasses'
import { findRender } from './findRender'

const getCatalogRowMock = getCatalogRow as jest.MockedFunction<typeof getCatalogRow>

describe('dataSource/renderOrchestration/findRender', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getCatalogRowMock.mockResolvedValue(undefined)
    })

    const roomId = 'ROOM#one' as EphemeraRoomId
    const markState: EphemeraCacheMarkState = { markValue: [{ mark: 'MARK#a', value: 'one' }] }
    const perspective: Perspective = { assetStack: ['ASSET#base'] }

    const baseResolve: RenderResolveInputSuccess = {
        type: 'success',
        roomId,
        perspective,
        markState,
        markProvenance: 'meta',
    }

    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: roomId,
        DataCategory: 'CACHE#valid',
        markState,
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
    }

    const baseDeps = () => ({
        getExactMatch: jest.fn().mockResolvedValue(null),
        getCacheRecordById: jest.fn(),
        clearPerspectivePointer: jest.fn().mockResolvedValue(undefined),
        computePerspectiveKey,
        markStatesEqual,
        perspectiveMatches,
        generateRoomPreview: jest.fn().mockResolvedValue('fail'),
        publishOrchestration: jest.fn().mockResolvedValue(undefined),
        flushMessageBusLane: jest.fn().mockResolvedValue(undefined),
    })

    it('emits Current Cache Valid on valid pointer fast-path', async () => {
        const deps = baseDeps()
        const authoritativeRecord = { ...baseCacheRecord, catalogVersion: 1 }
        deps.getCacheRecordById.mockResolvedValue(authoritativeRecord)
        getCatalogRowMock.mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Cache::PERSPECTIVE#v1#abc',
            assetStack: ['ASSET#base'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
        })
        const resolve: RenderResolveInputSuccess = {
            ...baseResolve,
            pointerHint: 'CACHE#valid',
        }
        await findRender(resolve, deps)
        expect(deps.publishOrchestration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'Current Cache Valid',
                cacheId: 'CACHE#valid',
            })
        )
        expect(deps.getExactMatch).not.toHaveBeenCalled()
        expect(deps.generateRoomPreview).not.toHaveBeenCalled()
    })

    it('clears pointer and emits Generation Deferred when pointer row is missing', async () => {
        const deps = baseDeps()
        deps.getCacheRecordById.mockResolvedValue(undefined)
        const resolve: RenderResolveInputSuccess = {
            ...baseResolve,
            pointerHint: 'CACHE#missing',
            allowGeneration: false,
        }
        await findRender(resolve, deps)
        expect(deps.clearPerspectivePointer).toHaveBeenCalled()
        expect(deps.publishOrchestration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'Generation Deferred',
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            })
        )
    })

    it('emits Exact Match Found on exact match when no pointer', async () => {
        const deps = baseDeps()
        deps.getExactMatch.mockResolvedValue(baseCacheRecord)
        await findRender(baseResolve, deps)
        expect(deps.publishOrchestration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'Exact Match Found',
                cacheId: 'CACHE#valid',
            })
        )
        expect(deps.getCacheRecordById).not.toHaveBeenCalled()
        expect(deps.generateRoomPreview).not.toHaveBeenCalled()
    })

    it('emits Generation Deferred when generation is skipped (allowGeneration false)', async () => {
        const deps = baseDeps()
        await findRender({ ...baseResolve, allowGeneration: false }, deps)
        expect(deps.publishOrchestration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'Generation Deferred',
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            })
        )
        expect(deps.generateRoomPreview).not.toHaveBeenCalled()
    })

    it('clears pointer when row is not authoritative for catalog epoch', async () => {
        const deps = baseDeps()
        deps.getCacheRecordById.mockResolvedValue({ ...baseCacheRecord, catalogVersion: 1 })
        getCatalogRowMock.mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Cache::PERSPECTIVE#v1#abc',
            assetStack: ['ASSET#base'],
            catalogVersion: 2,
            hydratedCatalogVersion: 2,
        })
        deps.getExactMatch.mockResolvedValue(null)
        const resolve: RenderResolveInputSuccess = {
            ...baseResolve,
            pointerHint: 'CACHE#valid',
            allowGeneration: false,
        }
        await findRender(resolve, deps)
        expect(deps.clearPerspectivePointer).toHaveBeenCalled()
        expect(deps.publishOrchestration).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'Generation Deferred' })
        )
    })

    it('continues after clear when pointer markState mismatches then exact match hits', async () => {
        const deps = baseDeps()
        const badRow = { ...baseCacheRecord, markState: { markValue: [] } }
        deps.getCacheRecordById.mockResolvedValue(badRow)
        deps.getExactMatch.mockResolvedValue(baseCacheRecord)
        const resolve: RenderResolveInputSuccess = {
            ...baseResolve,
            pointerHint: 'CACHE#stale',
        }
        await findRender(resolve, deps)
        expect(deps.clearPerspectivePointer).toHaveBeenCalled()
        expect(deps.publishOrchestration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'Exact Match Found',
                cacheId: 'CACHE#valid',
            })
        )
    })

    it('continues to Generation Deferred if pointer clearing throws', async () => {
        const deps = baseDeps()
        deps.getCacheRecordById.mockResolvedValue(undefined)
        deps.clearPerspectivePointer.mockRejectedValue(new Error('boom'))
        const resolve: RenderResolveInputSuccess = {
            ...baseResolve,
            pointerHint: 'CACHE#x',
            allowGeneration: false,
        }
        await findRender(resolve, deps)
        expect(deps.publishOrchestration).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'Generation Deferred',
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            })
        )
    })

    it('calls slow-path generation without resolve-level generationContextWml', async () => {
        const deps = baseDeps()
        const resolve: RenderResolveInputSuccess = {
            ...baseResolve,
            allowGeneration: true,
        }
        await findRender(resolve, deps)
        expect(deps.generateRoomPreview).toHaveBeenCalledWith(
            expect.not.objectContaining({ generationContextWml: expect.anything() }),
            expect.objectContaining({
                flushOrchestrationLane: expect.any(Function),
            })
        )
    })
})
