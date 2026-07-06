import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectRelationalChange } from './applyObjectRelationalChange'
import { EphemeraPositionGraph } from '../../positionGraph'
import * as kernelPersist from '../applyHostRelationalPatch'

jest.mock('../applyHostRelationalPatch', () => ({
    applyHostRelationalPatch: jest.fn(),
}))

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getPositionGraph: jest.fn(),
            set: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import internalCache from '../../../../internalCache'

const applyHostRelationalPatchMock = kernelPersist.applyHostRelationalPatch as jest.MockedFunction<
    typeof kernelPersist.applyHostRelationalPatch
>

const BROOM_ID = 'OBJECT#Broom' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const roomGraphWithObjects = {
    nodes: [
        { tag: 'Object' as const, universalKey: BROOM_ID },
        { tag: 'Object' as const, universalKey: TABLE_ID },
    ],
    edges: [],
}

describe('applyObjectRelationalChange', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        ;(internalCache.Positions.getPositionGraph as jest.Mock).mockResolvedValue(roomGraphWithObjects)
    })

    it('skips side-effect bundle when relation is unchanged', async () => {
        ;(internalCache.Positions.getPositionGraph as jest.Mock).mockResolvedValue({
            ...roomGraphWithObjects,
            edges: [{
                tag: 'Relational' as const,
                from: BROOM_ID,
                to: TABLE_ID,
                kind: 'On' as const,
            }],
        })

        const result = await applyObjectRelationalChange(
            {
                subjectId: BROOM_ID,
                targetId: TABLE_ID,
                roomId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({ ok: true, changed: false })
        expect(applyHostRelationalPatchMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('runs relational-changed bundle on successful establish', async () => {
        applyHostRelationalPatchMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: [
                EphemeraPositionGraph.fromFieldPayload(ROOM_ID, {
                    nodes: roomGraphWithObjects.nodes,
                    edges: [{
                        tag: 'Relational' as const,
                        from: BROOM_ID,
                        to: TABLE_ID,
                        kind: 'On' as const,
                    }],
                }),
            ],
        })

        const result = await applyObjectRelationalChange(
            {
                subjectId: BROOM_ID,
                targetId: TABLE_ID,
                roomId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                type: 'Object Relation Changed',
                subjectId: BROOM_ID,
                targetId: TABLE_ID,
                hostRoomId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            }),
        }))
        expect(internalCache.Positions.set).toHaveBeenCalledWith(expect.objectContaining({
            componentId: ROOM_ID,
        }))
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: ROOM_ID,
        })
    })
})
