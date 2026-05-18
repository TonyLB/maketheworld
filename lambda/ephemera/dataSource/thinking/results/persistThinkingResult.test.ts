jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('@tonylb/mtw-gateways/ts/ephemera/thinking', () => {
    const actual = jest.requireActual('@tonylb/mtw-gateways/ts/ephemera/thinking')
    return {
        ...actual,
        thinkingDeleteAtFromTerminalIso: jest.fn(() => 1735689600),
    }
})
jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        ThinkingResults: {
            invalidate: jest.fn(),
        },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../internalCache'
import { persistThinkingResult } from './persistThinkingResult'

const validEvent = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    workItemId: '11111111-2222-3333-4444-555555555555',
    segment: 'candidates' as const,
    ok: true,
    completedAt: '2026-01-01T00:00:00.000Z',
}

describe('persistThinkingResult', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(ephemeraDB.putItem as jest.Mock).mockResolvedValue(undefined)
        ;(ephemeraDB.nonCollidingPutItem as jest.Mock).mockResolvedValue(true)
    })

    it('returns invalidPayload when content is not a ThinkingResultEvent', async () => {
        const out = await persistThinkingResult({ foo: 1 })
        expect(out).toBe('invalidPayload')
        expect(ephemeraDB.putItem).not.toHaveBeenCalled()
    })

    it('writes adjacency then result, invalidates cache when nonCollidingPutItem succeeds', async () => {
        const out = await persistThinkingResult(validEvent)
        expect(out).toBe('written')
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: 'JOB#aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            DataCategory: 'TASK#11111111-2222-3333-4444-555555555555',
            deleteAt: 1735689600,
        })
        expect(ephemeraDB.nonCollidingPutItem).toHaveBeenCalledWith({
            EphemeraId: 'TASK#11111111-2222-3333-4444-555555555555',
            DataCategory: 'Meta::Result',
            schemaVersion: 1,
            generationId: validEvent.generationId,
            workItemId: validEvent.workItemId,
            segment: 'candidates',
            ok: true,
            completedAt: validEvent.completedAt,
            deleteAt: 1735689600,
        })
        expect(internalCache.ThinkingResults.invalidate).toHaveBeenCalledWith(validEvent.workItemId)
    })

    it('includes optional error and verbose fields on the Dynamo item', async () => {
        const withOptional = {
            ...validEvent,
            errorCode: 'E_TEST',
            errorMessage: 'failed',
            verbose: { hop: 1 },
        }
        await persistThinkingResult(withOptional)
        expect(ephemeraDB.nonCollidingPutItem).toHaveBeenCalledWith(
            expect.objectContaining({
                errorCode: 'E_TEST',
                errorMessage: 'failed',
                verbose: { hop: 1 },
            })
        )
    })

    it('returns alreadyFinalized and does not invalidate when nonCollidingPutItem returns false', async () => {
        ;(ephemeraDB.nonCollidingPutItem as jest.Mock).mockResolvedValue(false)
        const out = await persistThinkingResult(validEvent)
        expect(out).toBe('alreadyFinalized')
        expect(internalCache.ThinkingResults.invalidate).not.toHaveBeenCalled()
    })
})
