import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from '../../../dataSource/renderOrchestration/baseClasses'
import { renderResolveOutputToGenerateRoomPreviewResult } from './renderResolveOutputToGenerateRoomPreviewResult'

describe('renderResolveOutputToGenerateRoomPreviewResult', () => {
    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
    }

    it('maps invalidate to NO_EXACT_MATCH failure with reason or default message', () => {
        expect(
            renderResolveOutputToGenerateRoomPreviewResult({
                type: 'invalidate',
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            })
        ).toEqual({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        })
        expect(
            renderResolveOutputToGenerateRoomPreviewResult({
                type: 'invalidate',
            })
        ).toMatchObject({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
        })
        const noReason = renderResolveOutputToGenerateRoomPreviewResult({ type: 'invalidate' })
        expect(noReason.success).toBe(false)
        if (!noReason.success) {
            expect(noReason.errorMessage).toContain(RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION)
        }
    })

    it('maps resolved with cache metadata to success', () => {
        expect(
            renderResolveOutputToGenerateRoomPreviewResult({
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid',
                cacheRecord: baseCacheRecord,
            })
        ).toEqual({
            success: true,
            renderedContent: baseCacheRecord.renderedContent,
            cacheId: 'CACHE#valid',
            cacheRecord: baseCacheRecord,
        })
    })

    it('maps resolved missing cache metadata to NO_EXACT_MATCH failure', () => {
        expect(
            renderResolveOutputToGenerateRoomPreviewResult({
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
            })
        ).toEqual({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'Resolved outcome missing cacheId or cacheRecord.',
        })
    })

    it('maps preview-eligible failed codes', () => {
        expect(
            renderResolveOutputToGenerateRoomPreviewResult({
                type: 'failed',
                errorCode: 'NO_EXACT_MATCH',
                errorMessage: 'm',
            })
        ).toEqual({
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage: 'm',
        })
        expect(
            renderResolveOutputToGenerateRoomPreviewResult({
                type: 'failed',
                errorCode: 'NOT_ROOM',
                errorMessage: 'n',
            })
        ).toEqual({
            success: false,
            errorCode: 'NOT_ROOM',
            errorMessage: 'n',
        })
    })

    it('maps META_ROOM_MARKS_MISSING to GENERATION_FAILED', () => {
        expect(
            renderResolveOutputToGenerateRoomPreviewResult({
                type: 'failed',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: 'x',
            })
        ).toEqual({
            success: false,
            errorCode: 'GENERATION_FAILED',
            errorMessage: 'x',
        })
    })
})
