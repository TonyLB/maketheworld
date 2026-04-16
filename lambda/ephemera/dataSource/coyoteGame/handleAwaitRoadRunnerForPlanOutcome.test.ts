jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CoyoteGame: { get: jest.fn() },
        RoomCharacterList: { get: jest.fn() },
    },
}))

jest.mock('../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1000),
}))

import internalCache from '../../internalCache'
import { handleAwaitRoadRunnerForPlanOutcome } from './handleAwaitRoadRunnerForPlanOutcome'

const coyoteMock = internalCache.CoyoteGame.get as jest.MockedFunction<typeof internalCache.CoyoteGame.get>
const roomListMock = internalCache.RoomCharacterList.get as jest.MockedFunction<typeof internalCache.RoomCharacterList.get>

const awaitPayload = {
    type: 'Await RoadRunner' as const,
    characterId: 'CHARACTER#trigger',
    confidence: 0.9,
}

describe('handleAwaitRoadRunnerForPlanOutcome', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        coyoteMock.mockResolvedValue(['VORTEX'])
        roomListMock.mockResolvedValue([
            { EphemeraId: 'CHARACTER#guest', DisplayName: 'G', SessionIds: ['sess1'] },
        ])
    })

    const busMocks = () => ({
        send: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
    })

    it('no-ops when no active characters in coyote rooms', async () => {
        roomListMock.mockResolvedValue([])
        const streamEvent = jest.fn()
        const messageBus = busMocks()
        await handleAwaitRoadRunnerForPlanOutcome(awaitPayload, { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.send).not.toHaveBeenCalled()
        expect(messageBus.flush).not.toHaveBeenCalled()
    })

    it('broadcasts plan outcome WorldMessages and stream events', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const messageBus = busMocks()
        await handleAwaitRoadRunnerForPlanOutcome(awaitPayload, { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent.mock.calls[0][0].streamKey).toBe('CHARACTER#trigger')
        expect(streamEvent.mock.calls[0][0].header.type).toBe('Plan Outcome Generation Started')
        expect(streamEvent.mock.calls[1][0].header.type).toBe('Plan Outcome Generation Result')

        expect(messageBus.send).toHaveBeenCalledTimes(2)
        const first = messageBus.send.mock.calls[0][0] as Record<string, unknown>
        const firstLane = messageBus.send.mock.calls[0][1]
        const second = messageBus.send.mock.calls[1][0] as Record<string, unknown>
        expect(first.targets).toEqual(['CHARACTER#guest'])
        expect(first.message).toEqual(['Outcome: Generating...'])
        expect(firstLane).toMatch(/^outcomeLane:MESSAGE#/)
        expect(second.message).toEqual(['Outcome: Stubbed'])
        expect(first.messageId).toBe(second.messageId)
        expect(first.createdTime).toBe(1000)
        expect(second.createdTime).toBe(1001)
        expect(messageBus.flush).toHaveBeenCalledWith(firstLane)
    })
})
