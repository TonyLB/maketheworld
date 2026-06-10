jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        ThinkingResults: {
            get: jest.fn(),
        },
    },
}))

jest.mock('../messageBus', () => ({
    __esModule: true,
    default: {
        publish: jest.fn(),
    },
}))

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import { handleFetchThinkingResult } from './index'

const mockPublish = messageBus.publish as jest.Mock

const mockGet = internalCache.ThinkingResults.get as jest.Mock

describe('handleFetchThinkingResult', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    const validResult = {
        schemaVersion: 1,
        generationId: 'gen-1',
        workItemId: 'work-1',
        segment: 'candidates' as const,
        ok: true,
        completedAt: '2026-05-14T13:00:00.000Z',
    }

    it('returns ThinkingResult when cache has a valid row', async () => {
        mockGet.mockResolvedValue(validResult)

        await handleFetchThinkingResult(
            {
                message: 'fetchThinkingResult',
                workItemId: 'work-1',
                RequestId: 'req-1',
            },
            messageBus
        )

        expect(mockGet).toHaveBeenCalledWith('work-1')
        expect(mockPublish).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'ThinkingResult',
                RequestId: 'req-1',
                result: validResult,
            },
        })
    })

    it('returns NOT_FOUND when cache returns null', async () => {
        mockGet.mockResolvedValue(null)

        await handleFetchThinkingResult(
            {
                message: 'fetchThinkingResult',
                workItemId: 'work-missing',
                RequestId: 'req-2',
            },
            messageBus
        )

        expect(mockPublish).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: 'req-2',
                message: 'No thinking result for workItemId work-missing',
                error: 'THINKING_RESULT_NOT_FOUND',
            },
        })
    })

    it('returns MISSING_REQUEST_ID when RequestId is absent', async () => {
        await handleFetchThinkingResult(
            {
                message: 'fetchThinkingResult',
                workItemId: 'work-1',
            },
            messageBus
        )

        expect(mockGet).not.toHaveBeenCalled()
        expect(mockPublish).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                message: 'RequestId is required for fetchThinkingResult',
                error: 'THINKING_RESULT_MISSING_REQUEST_ID',
            },
        })
    })

    it('returns INVALID_REQUEST when workItemId is empty', async () => {
        await handleFetchThinkingResult(
            {
                message: 'fetchThinkingResult',
                workItemId: '',
                RequestId: 'req-3',
            },
            messageBus
        )

        expect(mockGet).not.toHaveBeenCalled()
        expect(mockPublish).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: 'req-3',
                message: 'Invalid fetchThinkingResult request',
                error: 'THINKING_RESULT_INVALID_REQUEST',
            },
        })
    })

    it('returns INVALID_STORED when cache row fails validation', async () => {
        mockGet.mockResolvedValue({ workItemId: 'bad' })

        await handleFetchThinkingResult(
            {
                message: 'fetchThinkingResult',
                workItemId: 'work-1',
                RequestId: 'req-4',
            },
            messageBus
        )

        expect(mockPublish).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: 'req-4',
                message: 'Stored thinking result failed validation',
                error: 'THINKING_RESULT_INVALID_STORED',
            },
        })
    })
})
