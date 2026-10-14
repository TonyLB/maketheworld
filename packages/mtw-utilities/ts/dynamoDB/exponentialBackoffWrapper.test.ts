import { exponentialBackoffWrapper } from './index'

// AWS SDK v3 errors carry `name`, not `errorType` (which only Lambda runtime errors set).
const sdkError = (name: string): Error => {
    const error = new Error(name)
    error.name = name
    return error
}

describe('exponentialBackoffWrapper', () => {
    it('retries an SDK-shaped error matched on name', async () => {
        const tryClause = jest.fn()
            .mockRejectedValueOnce(sdkError('TransactionCanceledException'))
            .mockResolvedValueOnce('done')
        const result = await exponentialBackoffWrapper(tryClause, { retryErrors: ['TransactionCanceledException'] })
        expect(result).toBe('done')
        expect(tryClause).toHaveBeenCalledTimes(2)
    })

    it('still retries an error carrying errorType', async () => {
        const error: any = new Error('cancelled')
        error.errorType = 'TransactionCanceledException'
        const tryClause = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('done')
        expect(await exponentialBackoffWrapper(tryClause, { retryErrors: ['TransactionCanceledException'] })).toBe('done')
        expect(tryClause).toHaveBeenCalledTimes(2)
    })

    it('does not retry an unlisted error', async () => {
        const tryClause = jest.fn().mockRejectedValue(sdkError('ValidationException'))
        await exponentialBackoffWrapper(tryClause, { retryErrors: ['TransactionCanceledException'] }).catch(() => undefined)
        expect(tryClause).toHaveBeenCalledTimes(1)
    })
})
