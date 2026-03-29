import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION } from '../../../renderOrchestration/baseClasses'
import { toGenerateRoomPreviewResult } from './toGenerateRoomPreviewResult'

describe('toGenerateRoomPreviewResult', () => {
    const baseCacheRecord: EphemeraCacheDynamoItem = {
        EphemeraId: 'ROOM#one',
        DataCategory: 'CACHE#valid',
        markState: { markValue: [{ mark: 'MARK#a', value: 'one' }] },
        renderedContent: { description: [] },
        provenance: { type: 'authored' },
        perspectiveId: 'PERSPECTIVE#legacy',
        perspectiveMatcher: { requiredAssetIds: ['ASSET#base'], forbiddenAssetIds: [] },
    }

    it('returns invalidate with reason', () => {
        expect(
            toGenerateRoomPreviewResult({
                type: 'invalidate',
                reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
            })
        ).toEqual({
            kind: 'invalidate',
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        })
    })

    it('returns preview_terminal success when resolved has cache metadata', () => {
        expect(
            toGenerateRoomPreviewResult({
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid',
                cacheRecord: baseCacheRecord,
            })
        ).toEqual({
            kind: 'preview_terminal',
            result: {
                success: true,
                renderedContent: baseCacheRecord.renderedContent,
                cacheId: 'CACHE#valid',
                cacheRecord: baseCacheRecord,
            },
        })
    })

    it('returns no_terminal when resolved missing cacheId or cacheRecord', () => {
        expect(
            toGenerateRoomPreviewResult({
                type: 'resolved',
                renderedContent: baseCacheRecord.renderedContent,
            })
        ).toEqual({ kind: 'no_terminal', reason: 'resolved_missing_cache_metadata' })
    })

    it('returns preview_terminal failure for preview-eligible error codes', () => {
        expect(
            toGenerateRoomPreviewResult({
                type: 'failed',
                errorCode: 'NO_EXACT_MATCH',
                errorMessage: 'm',
            })
        ).toEqual({
            kind: 'preview_terminal',
            result: { success: false, errorCode: 'NO_EXACT_MATCH', errorMessage: 'm' },
        })
    })

    it('returns no_terminal for META_ROOM_MARKS_MISSING', () => {
        expect(
            toGenerateRoomPreviewResult({
                type: 'failed',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: 'x',
            })
        ).toEqual({ kind: 'no_terminal', reason: 'unexpected_meta_room_marks_missing' })
    })
})
