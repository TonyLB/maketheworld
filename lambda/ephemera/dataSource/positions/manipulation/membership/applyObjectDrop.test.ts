import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectDrop } from './applyObjectDrop'
import { EphemeraPositionGraph } from '../../positionGraph'
import * as kernelPersist from '../applyHostEffects'

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

const OBJECT_ID = 'OBJECT#Broom' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

describe('applyObjectDrop', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips side-effect bundle when placement is unchanged', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([ROOM_ID])

        const result = await applyObjectDrop(
            { objectId: OBJECT_ID, roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [],
            to: ROOM_ID,
            changed: false,
        })
        expect(applyHostEffectsMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('runs membership-changed bundle on successful drop', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([CHARACTER_ID])
        applyHostEffectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: [
                EphemeraPositionGraph.fromFieldPayload(ROOM_ID, {
                    nodes: [{ tag: 'Object' as const, universalKey: OBJECT_ID }],
                    edges: [],
                }),
                EphemeraPositionGraph.fromFieldPayload(CHARACTER_ID, { nodes: [], edges: [] }),
            ],
        })

        const result = await applyObjectDrop(
            { objectId: OBJECT_ID, roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [CHARACTER_ID],
            to: ROOM_ID,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                type: 'Object Moved',
                objectId: OBJECT_ID,
                froms: [CHARACTER_ID],
                to: ROOM_ID,
            }),
        }))
        expect(internalCache.Positions.set).toHaveBeenCalledWith(
            expect.objectContaining({ hostId: ROOM_ID })
        )
        expect(internalCache.Positions.set).toHaveBeenCalledWith(
            expect.objectContaining({ hostId: CHARACTER_ID })
        )
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: OBJECT_ID,
            containers: [ROOM_ID],
        })
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: ROOM_ID,
        })
    })
})
