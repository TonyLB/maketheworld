import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testPositionGraph } from '../../positionGraph/testFixtures'
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

const roomGraphWithObjects = testPositionGraph(ROOM_ID, {
    nodes: [
        { tag: 'Object' as const, universalKey: BROOM_ID },
        { tag: 'Object' as const, universalKey: TABLE_ID },
    ],
})

describe('applyObjectRelationalChange', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips side-effect bundle when the kernel reports no change (BD-15/16 slice 3: decided live, not precomputed)', async () => {
        applyHostRelationalPatchMock.mockResolvedValue({ ok: true, persisted: false, changed: false })

        const result = await applyObjectRelationalChange(
            {
                subjectId: BROOM_ID,
                targetId: TABLE_ID,
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({ ok: true, changed: false })
        expect(applyHostRelationalPatchMock).toHaveBeenCalledTimes(1)
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('surfaces a kernel failure', async () => {
        applyHostRelationalPatchMock.mockResolvedValue({
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED',
            errorMessage: 'stale candidate',
        })

        const result = await applyObjectRelationalChange(
            {
                subjectId: BROOM_ID,
                targetId: TABLE_ID,
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED',
            errorMessage: 'stale candidate',
        })
        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('runs relational-changed bundle on successful establish', async () => {
        applyHostRelationalPatchMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: [
                EphemeraPositionGraph.fromFieldPayload(ROOM_ID, {
                    nodes: roomGraphWithObjects.toStored().nodes,
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
                hostId: ROOM_ID,
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
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            }),
        }))
        expect(internalCache.Positions.set).toHaveBeenCalledWith(
            expect.objectContaining({ hostId: ROOM_ID })
        )
        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: ROOM_ID,
        })
    })

    it('seeds the cache but skips RoomUpdate for a Character-hosted relation (BD-15/16 slice 4c)', async () => {
        const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
        const STRING_ID = 'OBJECT#String' as EphemeraObjectId
        const TOP_ID = 'OBJECT#Top' as EphemeraObjectId
        const characterGraph = EphemeraPositionGraph.fromFieldPayload(CHARACTER_ID, {
            nodes: [
                { tag: 'Object' as const, universalKey: STRING_ID },
                { tag: 'Object' as const, universalKey: TOP_ID },
            ],
            edges: [{
                tag: 'Relational' as const,
                from: STRING_ID,
                to: TOP_ID,
                kind: 'Custom' as const,
                relationLabel: 'wrapped around',
            }],
        })
        applyHostRelationalPatchMock.mockResolvedValue({
            ok: true,
            persisted: true,
            changed: true,
            postApplyGraphs: [characterGraph],
        })

        const result = await applyObjectRelationalChange(
            {
                subjectId: STRING_ID,
                targetId: TOP_ID,
                hostId: CHARACTER_ID,
                relationKind: 'Custom',
                relationLabel: 'wrapped around',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        })
        expect(internalCache.Positions.set).toHaveBeenCalledWith(
            expect.objectContaining({ hostId: CHARACTER_ID })
        )
        expect(messageBus.publish).not.toHaveBeenCalled()
    })
})
