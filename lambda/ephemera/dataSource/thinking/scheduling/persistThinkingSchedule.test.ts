jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        ThinkingSchedules: {
            invalidate: jest.fn(),
        },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'
import { persistThinkingSchedule } from './persistThinkingSchedule'

const validEvent = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemId: '11111111-2222-3333-4444-555555555555',
    segment: 'candidates' as const,
    scheduleStatus: 'scheduled' as const,
}

describe('persistThinkingSchedule', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(ephemeraDB.putItem as jest.Mock).mockResolvedValue(undefined)
    })

    it('returns invalidPayload when content is not a ThinkingScheduleEvent', async () => {
        const out = await persistThinkingSchedule({ foo: 1 })
        expect(out).toBe('invalidPayload')
        expect(ephemeraDB.putItem).not.toHaveBeenCalled()
    })

    it('writes adjacency then schedule row and invalidates cache', async () => {
        const out = await persistThinkingSchedule(validEvent)
        expect(out).toBe('written')
        expect(ephemeraDB.putItem).toHaveBeenCalledTimes(2)
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(1, {
            EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            DataCategory: 'TASK#11111111-2222-3333-4444-555555555555',
        })
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(2, {
            EphemeraId: 'TASK#11111111-2222-3333-4444-555555555555',
            DataCategory: 'Meta::Schedule',
            schemaVersion: 1,
            generationId: validEvent.generationId,
            workItemId: validEvent.workItemId,
            segment: 'candidates',
            scheduleStatus: 'scheduled',
        })
        expect(internalCache.ThinkingSchedules.invalidate).toHaveBeenCalledWith(validEvent.workItemId)
    })

    it('includes optional enqueuedAt on the Dynamo item', async () => {
        await persistThinkingSchedule({
            ...validEvent,
            enqueuedAt: '2026-01-01T00:00:00.000Z',
        })
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                enqueuedAt: '2026-01-01T00:00:00.000Z',
            })
        )
    })

    it('overwrites schedule on repeat putItem calls', async () => {
        await persistThinkingSchedule({ ...validEvent, scheduleStatus: 'claimed' })
        expect(ephemeraDB.putItem).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ scheduleStatus: 'claimed' })
        )
    })
})
