jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CoyoteGame: { get: jest.fn(), invalidate: jest.fn() },
        RoomCharacterList: { get: jest.fn() },
    },
}))

jest.mock('../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1000),
}))

import internalCache from '../../../internalCache'
import { handleObjectsChangedForHypothesis } from './handleObjectsChangedForHypothesis'
import type { ObjectsChangedPayload } from '../../objects/events'

const coyoteMock = internalCache.CoyoteGame.get as jest.MockedFunction<typeof internalCache.CoyoteGame.get>
const roomListMock = internalCache.RoomCharacterList.get as jest.MockedFunction<typeof internalCache.RoomCharacterList.get>
const coyoteInvalidateMock = internalCache.CoyoteGame.invalidate as jest.MockedFunction<typeof internalCache.CoyoteGame.invalidate>

const basePayload = (over: Partial<ObjectsChangedPayload> = {}): ObjectsChangedPayload => ({
    type: 'Objects Changed',
    componentId: 'ROOM#VORTEX',
    add: [{ uuid: 'OBJECT#o1', shortName: 'crate', stableKey: 'crate' }],
    remove: [],
    priorObjects: [],
    newObjects: [{ uuid: 'OBJECT#o1', shortName: 'crate', stableKey: 'crate' }],
    ...over,
})

describe('handleObjectsChangedForHypothesis', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        coyoteMock.mockResolvedValue(['VORTEX', 'STRAIGHTAWAY'])
        roomListMock.mockResolvedValue([
            { EphemeraId: 'CHARACTER#guest', DisplayName: 'G', SessionIds: ['sess1'] },
        ])
        coyoteInvalidateMock.mockResolvedValue(undefined)
    })

    const busMocks = () => ({
        send: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
    })

    it('no-ops when add is empty', async () => {
        const streamEvent = jest.fn()
        const messageBus = busMocks()
        await handleObjectsChangedForHypothesis(basePayload({ add: [], newObjects: [] }), { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.send).not.toHaveBeenCalled()
        expect(messageBus.flush).not.toHaveBeenCalled()
    })

    it('no-ops when room is not a Coyote demo room', async () => {
        const streamEvent = jest.fn()
        const messageBus = busMocks()
        await handleObjectsChangedForHypothesis(basePayload({ componentId: 'ROOM#OTHER' }), { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.send).not.toHaveBeenCalled()
        expect(messageBus.flush).not.toHaveBeenCalled()
    })

    it('no-ops when no active occupants (no sessions)', async () => {
        roomListMock.mockResolvedValue([
            { EphemeraId: 'CHARACTER#idle', DisplayName: 'I', SessionIds: [] },
        ])
        const streamEvent = jest.fn()
        const messageBus = busMocks()
        await handleObjectsChangedForHypothesis(basePayload(), { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.send).not.toHaveBeenCalled()
        expect(messageBus.flush).not.toHaveBeenCalled()
    })

    it('emits stream events and two CoyoteGameHypothesisMessage publishes with shared messageId', async () => {
        coyoteMock
            .mockResolvedValueOnce(['VORTEX', 'STRAIGHTAWAY'])
            .mockResolvedValueOnce({ intent: 'Hypothesis: Cached from CoyoteGame' })
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const messageBus = busMocks()
        await handleObjectsChangedForHypothesis(basePayload(), { streamEvent, messageBus })

        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent.mock.calls[0][0].header.type).toBe('Hypothesis Generation Started')
        expect(streamEvent.mock.calls[0][0].update.type).toBe('Hypothesis Generation Started')
        expect(streamEvent.mock.calls[1][0].header.type).toBe('Hypothesis Generation Result')
        expect(streamEvent.mock.calls[1][0].update.type).toBe('Hypothesis Generation Result')

        expect(messageBus.send).toHaveBeenCalledTimes(2)
        const first = messageBus.send.mock.calls[0][0] as Record<string, unknown>
        const firstLane = messageBus.send.mock.calls[0][1]
        const second = messageBus.send.mock.calls[1][0] as Record<string, unknown>
        expect(first.displayProtocol).toBe('CoyoteGameHypothesisMessage')
        expect(first.message).toEqual(['Hypothesis: Generating...'])
        expect(typeof firstLane).toBe('string')
        expect(firstLane).toMatch(/^hypothesisLane:MESSAGE#/)
        expect(second.displayProtocol).toBe('CoyoteGameHypothesisMessage')
        expect(second.message).toEqual(['Hypothesis: Cached from CoyoteGame'])
        expect(first.messageId).toBe(second.messageId)
        expect(typeof first.messageId).toBe('string')
        expect(first.createdTime).toBe(1000)
        expect(second.createdTime).toBe(1001)

        expect(coyoteInvalidateMock).toHaveBeenCalledWith('intent')
        expect(coyoteMock).toHaveBeenNthCalledWith(2, 'intent')
        expect(messageBus.flush).toHaveBeenCalledWith(firstLane)
    })

    it('filters ## Cartoon play-by-play walkthrough from terminal publish payload', async () => {
        coyoteMock
            .mockResolvedValueOnce(['VORTEX', 'STRAIGHTAWAY'])
            .mockResolvedValueOnce({
                walkthrough: '## Cartoon play-by-play\nYou climb the rocket and light the fuse.',
                intent: 'Hypothesis: It looks like you launch.',
            })
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const messageBus = busMocks()
        await handleObjectsChangedForHypothesis(basePayload(), { streamEvent, messageBus })

        const terminal = messageBus.send.mock.calls[1][0] as Record<string, unknown>
        expect(terminal.message).toEqual(['Hypothesis: It looks like you launch.'])
        const terminalRenderTree = terminal.message as unknown[]
        expect(
            terminalRenderTree.some((line) => typeof line === 'string' && /Cartoon play-by-play/i.test(line))
        ).toBe(false)
    })
})
