import {
    PreviewGenerationRequestsData,
    makePreviewGenerationPendingKey,
} from './previewGenerationRequests'

describe('PreviewGenerationRequestsData', () => {
    const roomId = 'ROOM#test-room' as const
    const perspectiveId = 'PERSPECTIVE#v1#abc123'

    it('makePreviewGenerationPendingKey is stable', () => {
        expect(makePreviewGenerationPendingKey(roomId, perspectiveId)).toBe('ROOM#test-room::PERSPECTIVE#v1#abc123')
    })

    it('registerPending appends multiple entries for the same key', () => {
        const cache = new PreviewGenerationRequestsData()
        cache.registerPending({ roomId, perspectiveId, requestId: 'a' })
        cache.registerPending({ roomId, perspectiveId, requestId: 'b' })
        expect(cache.getPending(roomId, perspectiveId)).toEqual([
            { requestId: 'a' },
            { requestId: 'b' },
        ])
    })

    it('registerPending dedupes the same requestId for a key', () => {
        const cache = new PreviewGenerationRequestsData()
        cache.registerPending({ roomId, perspectiveId, requestId: 'same' })
        cache.registerPending({ roomId, perspectiveId, requestId: 'same' })
        expect(cache.getPending(roomId, perspectiveId)).toEqual([{ requestId: 'same' }])
    })

    it('registerPending allows multiple entries without requestId', () => {
        const cache = new PreviewGenerationRequestsData()
        cache.registerPending({ roomId, perspectiveId })
        cache.registerPending({ roomId, perspectiveId })
        expect(cache.getPending(roomId, perspectiveId)).toEqual([{}, {}])
    })

    it('clear removes all pending entries', () => {
        const cache = new PreviewGenerationRequestsData()
        cache.registerPending({ roomId, perspectiveId, requestId: 'x' })
        cache.clear()
        expect(cache.getPending(roomId, perspectiveId)).toEqual([])
    })

    it('getPending returns empty array for unknown key', () => {
        const cache = new PreviewGenerationRequestsData()
        expect(cache.getPending(roomId, perspectiveId)).toEqual([])
    })
})
