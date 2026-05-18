jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        ThinkingJobs: {
            invalidate: jest.fn(),
        },
    },
}))

import internalCache from '../../../internalCache'

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { persistThinkingJobCreate } from './persistThinkingJobCreate'

const validCreate = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemIds: ['11111111-2222-3333-4444-555555555555', '22222222-3333-4444-5555-666666666666'],
    jobStatus: 'pending' as const,
}

describe('persistThinkingJobCreate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(ephemeraDB.putItem as jest.Mock).mockResolvedValue(undefined)
    })

    it('returns invalidPayload when content is not a ThinkingJobCreateEvent', async () => {
        const out = await persistThinkingJobCreate({ foo: 1 })
        expect(out).toBe('invalidPayload')
        expect(ephemeraDB.putItem).not.toHaveBeenCalled()
    })

    it('writes Meta::Job then adjacency rows for each workItemId', async () => {
        const out = await persistThinkingJobCreate(validCreate)
        expect(out).toBe('written')
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(3)
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(1, {
            EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            DataCategory: 'Meta::Job',
            schemaVersion: 1,
            generationId: validCreate.generationId,
            jobStatus: 'pending',
        })
        for (const call of (ephemeraDB.putItem as jest.Mock).mock.calls) {
            expect(call[0]).not.toHaveProperty('deleteAt')
        }
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(2, {
            EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            DataCategory: 'TASK#11111111-2222-3333-4444-555555555555',
        })
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(3, {
            EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            DataCategory: 'TASK#22222222-3333-4444-5555-666666666666',
        })
        expect(internalCache.ThinkingJobs.invalidate).toHaveBeenCalledWith(validCreate.generationId)
    })

    it('includes optional createdAt on the Meta::Job item', async () => {
        await persistThinkingJobCreate({
            ...validCreate,
            createdAt: '2026-01-01T00:00:00.000Z',
        })
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                createdAt: '2026-01-01T00:00:00.000Z',
            })
        )
    })
})
