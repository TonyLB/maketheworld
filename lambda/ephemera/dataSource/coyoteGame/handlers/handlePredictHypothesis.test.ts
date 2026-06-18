jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CoyoteGame: {
            invalidate: jest.fn(),
            get: jest.fn(),
        },
    },
}))

jest.mock('../utilities/hypothesisDebug', () => ({
    hypothesisDebugLog: jest.fn(),
}))

jest.mock('../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'hypothesis-uuid'),
}))

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PredictHypothesisPublishedPayload } from '../../actions/publishedEvents'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import internalCache from '../../../internalCache'
import { handlePredictHypothesis } from './handlePredictHypothesis'

const basePayload = (over: Partial<PredictHypothesisPublishedPayload> = {}): PredictHypothesisPublishedPayload => ({
    type: 'Predict Hypothesis' as const,
    characterId: 'CHARACTER#TESS' as EphemeraCharacterId,
    confidence: 0.95,
    ...over,
})

describe('handlePredictHypothesis', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const messageBus = { publish: jest.fn() }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.CoyoteGame.invalidate as jest.Mock).mockResolvedValue(undefined)
        ;(internalCache.CoyoteGame.get as jest.Mock).mockResolvedValue({ intent: 'Intent line' })
        ;(getCurrentTimestamp as jest.Mock).mockReturnValue(1_700_000_000_001)
    })

    it('no-ops when payload is not Predict Hypothesis', async () => {
        await handlePredictHypothesis({ type: 'Await RoadRunner' }, { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('publishes hypothesis placeholder and result to the requesting character only', async () => {
        await handlePredictHypothesis(basePayload(), { streamEvent, messageBus })

        expect(internalCache.CoyoteGame.invalidate).toHaveBeenCalledWith('intent')
        expect(internalCache.CoyoteGame.get).toHaveBeenCalledWith('intent')

        expect(messageBus.publish).toHaveBeenCalledTimes(2)
        const first = messageBus.publish.mock.calls[0][0] as Record<string, unknown>
        const second = messageBus.publish.mock.calls[1][0] as Record<string, unknown>
        expect(first.targets).toEqual(['CHARACTER#TESS'])
        expect(first.displayProtocol).toBe('CoyoteGameHypothesisMessage')
        expect(first.message).toEqual(['Hypothesis: Generating...'])
        expect(second.targets).toEqual(['CHARACTER#TESS'])
        expect(second.message).toEqual(['Intent line'])

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent.mock.calls[0][0].streamKey).toBe('CHARACTER#TESS')
        expect(streamEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
            header: { type: 'Hypothesis Generation Started' },
            update: expect.objectContaining({
                type: 'Hypothesis Generation Started',
                hypothesisId: 'MESSAGE#hypothesis-uuid',
                characterId: 'CHARACTER#TESS',
            }),
        }))
        expect(streamEvent.mock.calls[1][0].streamKey).toBe('CHARACTER#TESS')
        expect(streamEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
            header: { type: 'Hypothesis Generation Result' },
            update: expect.objectContaining({
                type: 'Hypothesis Generation Result',
                hypothesisId: 'MESSAGE#hypothesis-uuid',
                characterId: 'CHARACTER#TESS',
                renderTree: ['Intent line'],
            }),
        }))
    })
})
