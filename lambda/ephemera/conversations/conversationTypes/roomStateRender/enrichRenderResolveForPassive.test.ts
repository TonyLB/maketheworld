import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import type { RenderRequested } from '../../../renderOrchestration/events'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from '../../../renderOrchestration/baseClasses'
import { enrichRenderResolveForPassive } from './enrichRenderResolveForPassive'

describe('enrichRenderResolveForPassive', () => {
    const basePayload: RenderRequested = {
        type: 'RenderRequested',
        componentId: 'ROOM#one',
        perspective: { assetStack: ['ASSET#base'] },
    }

    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
    }

    it('returns RenderReady when resolved with cacheId and cacheRecord', () => {
        const result = enrichRenderResolveForPassive(basePayload, {
            type: 'resolved',
            renderedContent: baseCacheRecord.renderedContent,
            cacheId: 'CACHE#valid',
            cacheRecord: baseCacheRecord,
        })
        expect(result).toMatchObject({
            type: 'RenderReady',
            cacheId: 'CACHE#valid',
        })
    })

    it('returns RenderInvalidate on invalidate', () => {
        const result = enrichRenderResolveForPassive(basePayload, {
            type: 'invalidate',
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        })
        expect(result).toMatchObject({
            type: 'RenderInvalidate',
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        })
    })

    it('returns RenderError for META_ROOM_MARKS_MISSING', () => {
        const result = enrichRenderResolveForPassive(basePayload, {
            type: 'failed',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: 'RenderRequested requires Meta::Room.state.marks for ROOM#one',
        })
        expect(result).toMatchObject({
            type: 'RenderError',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: 'RenderRequested requires Meta::Room.state.marks for ROOM#one',
            componentId: 'ROOM#one',
        })
    })

    it('returns RenderError for other failures', () => {
        const result = enrichRenderResolveForPassive(basePayload, {
            type: 'failed',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
        })
        expect(result).toMatchObject({
            type: 'RenderError',
            errorCode: 'CONTEXT_REQUIRED',
            errorMessage: 'Generation context required',
            componentId: 'ROOM#one',
        })
    })

    it('returns undefined when resolved is missing cacheId and logs', () => {
        const err = jest.spyOn(console, 'error').mockImplementation(() => {})
        const result = enrichRenderResolveForPassive(basePayload, {
            type: 'resolved',
            renderedContent: baseCacheRecord.renderedContent,
        })
        expect(result).toBeUndefined()
        expect(err).toHaveBeenCalled()
        err.mockRestore()
    })
})
