jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        CoyoteGame: {
            invalidate: jest.fn(),
            get: jest.fn(),
        },
    },
}))

jest.mock('../../../internalCache/hydrateRoomRoster', () => ({
    getRoomCharacterList: jest.fn(),
}))

jest.mock('../utilities/isCoyoteGameRoom', () => ({
    isCoyoteGameRoom: jest.fn(),
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

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ObjectMovedPublishedPayload } from '../../positions/publishedEvents'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import internalCache from '../../../internalCache'
import { getRoomCharacterList } from '../../../internalCache/hydrateRoomRoster'
import { isCoyoteGameRoom } from '../utilities/isCoyoteGameRoom'
import { handleObjectMovedForHypothesis } from './handleObjectMovedForHypothesis'

const basePayload = (over: Partial<ObjectMovedPublishedPayload> = {}): ObjectMovedPublishedPayload => ({
    type: 'Object Moved' as const,
    objectId: 'OBJECT#o1' as EphemeraObjectId,
    froms: [] as EphemeraRoomId[],
    to: 'ROOM#VORTEX' as EphemeraRoomId,
    beatAnchorTime: 1_700_000_000_000,
    ...over,
})

describe('handleObjectMovedForHypothesis', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const messageBus = { publish: jest.fn() }

    beforeEach(() => {
        jest.clearAllMocks()
        ;(isCoyoteGameRoom as jest.Mock).mockResolvedValue(true)
        ;(getRoomCharacterList as jest.Mock).mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', SessionIds: ['SESSION#1'] },
        ])
        ;(internalCache.CoyoteGame.get as jest.Mock).mockResolvedValue({ intent: 'Intent line' })
        ;(getCurrentTimestamp as jest.Mock).mockReturnValue(1_700_000_000_001)
    })

    it('no-ops when to is null', async () => {
        await handleObjectMovedForHypothesis(basePayload({ to: null }), { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('no-ops when destination is not a Coyote game room', async () => {
        ;(isCoyoteGameRoom as jest.Mock).mockResolvedValue(false)
        await handleObjectMovedForHypothesis(basePayload({ to: 'ROOM#OTHER' }), { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('no-ops when room has no active occupants', async () => {
        ;(getRoomCharacterList as jest.Mock).mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', SessionIds: [] },
        ])
        await handleObjectMovedForHypothesis(basePayload(), { streamEvent, messageBus })
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('publishes hypothesis placeholder and result for active occupants', async () => {
        await handleObjectMovedForHypothesis(basePayload(), { streamEvent, messageBus })

        expect(messageBus.publish).toHaveBeenCalledTimes(2)
        expect(streamEvent).toHaveBeenCalledTimes(2)
        expect(streamEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
            header: { type: 'Hypothesis Generation Started' },
            update: expect.objectContaining({
                type: 'Hypothesis Generation Started',
                hypothesisId: 'MESSAGE#hypothesis-uuid',
                characterId: 'CHARACTER#TESS',
            }),
        }))
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
