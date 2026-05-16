import { describe, it, expect, vi, beforeEach } from 'vitest'

import { fetchThinkingResultAction } from './index.api'

vi.mock('../lifeLine', () => ({
    getStatus: vi.fn(() => 'CONNECTED'),
    socketDispatchPromise: vi.fn()
}))

import { socketDispatchPromise } from '../lifeLine'

const mockSocketDispatchPromise = vi.mocked(socketDispatchPromise)

describe('fetchThinkingResultAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns result on ThinkingResult response', async () => {
        mockSocketDispatchPromise.mockReturnValue((() => Promise.resolve({
            messageType: 'ThinkingResult',
            RequestId: 'req-1',
            result: {
                schemaVersion: 1,
                generationId: 'gen-1',
                workItemId: 'work-1',
                segment: 'candidates',
                ok: true,
                completedAt: '2026-05-14T13:00:00.000Z'
            }
        })) as any)

        const dispatch = vi.fn((thunk: any) => (typeof thunk === 'function' ? thunk(dispatch, vi.fn()) : thunk))
        const action = fetchThinkingResultAction({
            internalData: { id: 'work-1', incrementalBackoff: 0.5 },
            publicData: {},
            actions: {} as any
        })

        const result = await action(dispatch, vi.fn())

        expect(mockSocketDispatchPromise).toHaveBeenCalledWith({
            message: 'fetchThinkingResult',
            workItemId: 'work-1'
        })
        expect(result?.publicData?.result?.segment).toBe('candidates')
    })

    it('throws on Error response', async () => {
        mockSocketDispatchPromise.mockReturnValue((() => Promise.reject({
            messageType: 'Error',
            error: 'THINKING_RESULT_NOT_FOUND',
            message: 'No thinking result'
        })) as any)

        const dispatch = vi.fn((thunk: any) => (typeof thunk === 'function' ? thunk(dispatch, vi.fn()) : thunk))
        const action = fetchThinkingResultAction({
            internalData: { id: 'work-missing', incrementalBackoff: 0.5 },
            publicData: {},
            actions: {} as any
        })

        await expect(action(dispatch, vi.fn())).rejects.toBeDefined()
    })
})
