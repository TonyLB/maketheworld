import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectRoomMembership } from './applyObjectRoomMembership'
import { EphemeraPositionGraph } from '../positionGraph'
import * as kernelPersist from '../manipulation/applyHostEffects'

jest.mock('../manipulation/applyHostEffects', () => ({
    applyHostEffects: jest.fn(),
}))

jest.mock('../../../internalCache', () => ({
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

jest.mock('../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import internalCache from '../../../internalCache'

const applyHostEffectsMock = kernelPersist.applyHostEffects as jest.MockedFunction<
    typeof kernelPersist.applyHostEffects
>

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

describe('applyObjectRoomMembership', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips side-effect bundle when placement endpoint is unchanged', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])

        const result = await applyObjectRoomMembership(
            { objectId: OBJECT_ID, targetRoomId: FROM_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [],
            to: FROM_ROOM,
            changed: false,
        })
        expect(applyHostEffectsMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('runs membership-changed bundle when placement changes', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        applyHostEffectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: [
                EphemeraPositionGraph.fromFieldPayload(FROM_ROOM, { nodes: [], edges: [] }),
                EphemeraPositionGraph.fromFieldPayload(TO_ROOM, {
                    nodes: [{ tag: 'Object' as const, universalKey: OBJECT_ID }],
                    edges: [],
                }),
            ],
        })

        const result = await applyObjectRoomMembership(
            { objectId: OBJECT_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        }))
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: OBJECT_ID,
            header: { type: 'Object Moved' },
            update: expect.objectContaining({
                type: 'Object Moved',
                objectId: OBJECT_ID,
                froms: [FROM_ROOM],
                to: TO_ROOM,
                beatAnchorTime: 1_700_000_000_000,
            }),
        })
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: OBJECT_ID,
            containers: [TO_ROOM],
        })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: FROM_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: TO_ROOM })
        expect(messageBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'EphemeraUpdate',
        }))
    })
})
