import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { EphemeraPositionGraph } from '../../positionGraph'
import * as kernelPersist from '../applyHostEffects'
import { applyObjectClearMembership } from './applyObjectClearMembership'

jest.mock('../applyHostEffects', () => ({
    applyHostEffects: jest.fn(),
}))

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getMembershipContainers: jest.fn(),
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import internalCache from '../../../../internalCache'

const applyHostEffectsMock = kernelPersist.applyHostEffects as jest.MockedFunction<
    typeof kernelPersist.applyHostEffects
>

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyObjectClearMembership', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips side-effect bundle when object is not on any host', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([])

        const result = await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [],
            to: null,
            changed: false,
        })
        expect(applyHostEffectsMock).not.toHaveBeenCalled()
    })

    it('clears character inventory and streams Object Moved', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([CHARACTER_ID])
        applyHostEffectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: [
                EphemeraPositionGraph.fromFieldPayload(CHARACTER_ID, { nodes: [], edges: [] }),
            ],
        })

        const result = await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(applyHostEffectsMock).toHaveBeenCalledWith(
            {
                hostEffects: [
                    { hostId: CHARACTER_ID, identityId: OBJECT_ID, op: 'remove' },
                ],
            },
            undefined
        )
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [CHARACTER_ID],
            to: null,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        }))
        expect(internalCache.Positions.set).toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: OBJECT_ID,
            containers: [],
        })
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: OBJECT_ID,
            header: { type: 'Object Moved' },
            update: expect.objectContaining({
                type: 'Object Moved',
                objectId: OBJECT_ID,
                froms: [CHARACTER_ID],
                to: null,
            }),
        })
        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('clears room placement and publishes RoomUpdate', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        applyHostEffectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: [
                EphemeraPositionGraph.fromFieldPayload(FROM_ROOM, { nodes: [], edges: [] }),
            ],
        })

        await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: FROM_ROOM,
        })
    })
})
