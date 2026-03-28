import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { perspectiveMatches, computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { markStatesEqual } from '../renderCache/markStateUtils'
import type { RenderResolveInput } from './baseClasses'
import { findRender } from './findRender'

describe('findRender', () => {
    const roomId = 'ROOM#one' as EphemeraRoomId
    const markState: EphemeraCacheMarkState = { markValue: [{ mark: 'MARK#a', value: 'one' }] }
    const perspective: Perspective = { assetStack: ['ASSET#base'] }

    const baseResolve: RenderResolveInput = {
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
        tryGeneration: jest.fn().mockResolvedValue(null),
    })

    it('returns resolved on valid pointer fast-path', async () => {
        const deps = baseDeps()
        deps.getCacheRecordById.mockResolvedValue(baseCacheRecord)
        const resolve: RenderResolveInput = {
            ...baseResolve,
            pointerHint: 'CACHE#valid',
        }
        const out = await findRender(resolve, deps)
        expect(out).toEqual({
            type: 'resolved',
            renderedContent: baseCacheRecord.renderedContent,
            cacheId: 'CACHE#valid',
            cacheRecord: baseCacheRecord,
        })
        expect(deps.getExactMatch).not.toHaveBeenCalled()
        expect(deps.tryGeneration).not.toHaveBeenCalled()
    })

    it('clears pointer and continues when pointer row is missing', async () => {
        const deps = baseDeps()
        deps.getCacheRecordById.mockResolvedValue(undefined)
        const resolve: RenderResolveInput = {
            ...baseResolve,
            pointerHint: 'CACHE#missing',
        }
        const out = await findRender(resolve, deps)
        expect(deps.clearPerspectivePointer).toHaveBeenCalled()
        expect(out).toEqual({ type: 'lookup_handoff' })
    })

    it('short-circuits on exact match when no pointer', async () => {
        const deps = baseDeps()
        deps.getExactMatch.mockResolvedValue(baseCacheRecord)
        const out = await findRender(baseResolve, deps)
        expect(out.type).toBe('resolved')
        if (out.type === 'resolved') {
            expect(out.cacheId).toBe('CACHE#valid')
        }
        expect(deps.getCacheRecordById).not.toHaveBeenCalled()
        expect(deps.tryGeneration).not.toHaveBeenCalled()
    })

    it('returns lookup_handoff when tryGeneration returns null', async () => {
        const deps = baseDeps()
        deps.tryGeneration.mockResolvedValue(null)
        const out = await findRender(baseResolve, deps)
        expect(out).toEqual({ type: 'lookup_handoff' })
        expect(deps.tryGeneration).toHaveBeenCalled()
    })

    it('returns resolved when tryGeneration succeeds', async () => {
        const deps = baseDeps()
        deps.tryGeneration.mockResolvedValue({
            type: 'resolved',
            renderedContent: { description: [] },
            cacheId: 'CACHE#gen',
            cacheRecord: baseCacheRecord,
        })
        const out = await findRender(baseResolve, deps)
        expect(out.type).toBe('resolved')
        if (out.type === 'resolved') {
            expect(out.cacheId).toBe('CACHE#gen')
        }
    })

    it('returns failed when tryGeneration returns failure', async () => {
        const deps = baseDeps()
        deps.tryGeneration.mockResolvedValue({
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'need context',
        })
        const out = await findRender(baseResolve, deps)
        expect(out).toEqual({
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'need context',
        })
    })

    it('continues after clear when pointer markState mismatches then exact match hits', async () => {
        const deps = baseDeps()
        const badRow = { ...baseCacheRecord, markState: { markValue: [] } }
        deps.getCacheRecordById.mockResolvedValue(badRow)
        deps.getExactMatch.mockResolvedValue(baseCacheRecord)
        const resolve: RenderResolveInput = {
            ...baseResolve,
            pointerHint: 'CACHE#stale',
        }
        const out = await findRender(resolve, deps)
        expect(deps.clearPerspectivePointer).toHaveBeenCalled()
        expect(out.type).toBe('resolved')
        if (out.type === 'resolved') {
            expect(out.cacheId).toBe('CACHE#valid')
        }
    })

    it('continues to lookup handoff if pointer clearing throws', async () => {
        const deps = baseDeps()
        deps.getCacheRecordById.mockResolvedValue(undefined)
        deps.clearPerspectivePointer.mockRejectedValue(new Error('boom'))
        const resolve: RenderResolveInput = {
            ...baseResolve,
            pointerHint: 'CACHE#x',
        }
        const out = await findRender(resolve, deps)
        expect(out).toEqual({ type: 'lookup_handoff' })
    })
})
