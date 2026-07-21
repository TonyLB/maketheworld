import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'
import { applyObjectRelationalChangeWithTransfer } from './applyObjectRelationalChangeWithTransfer'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
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

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Simulates `transactWrite`'s `MultiKeyUpdate` handling, mirroring
 * `applyObjectSetTransfer.test.ts`'s convention: `transactWrite`'s own internal
 * fetch is the only fetch this kernel performs, so `graphsByHost` stands in for
 * whatever is actually in the database at commit time.
 */
const makeTransactWriteMock = (graphsByHost: Record<string, EphemeraPositionGraph>) => {
    const lastDraft: { current: Record<string, any> | undefined } = { current: undefined }
    const transactWrite: any = jest.fn(async (items: any[]): Promise<void> => {
        const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        if (!multiKeyItem) {
            return
        }
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
            const graph = graphsByHost[key.EphemeraId]
            draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                EphemeraId: key.EphemeraId,
                DataCategory: key.DataCategory,
                positionGraph: graph.toStored(),
            }
        })
        multiKeyItem.reducer(draft)
        lastDraft.current = draft
    })
    return { transactWrite, lastDraft }
}

describe('applyObjectRelationalChangeWithTransfer', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('BD-16 repaired worked example: moves the tray from the character to the room and establishes the relation, atomically', async () => {
        const heldGraph = testPositionGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }] })
        const { transactWrite, lastDraft } = makeTransactWriteMock({ [CHARACTER_ID]: heldGraph, [ROOM_ID]: roomGraph })

        const result = await applyObjectRelationalChangeWithTransfer(
            {
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
                transferFromHostId: CHARACTER_ID,
            },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result).toMatchObject({ ok: true, changed: true })
        expect(transactWrite).toHaveBeenCalledTimes(1)

        const draft = lastDraft.current
        expect(draft).toBeDefined()
        expect(draft![`${CHARACTER_ID}#Meta::Character`].positionGraph).toEqual({ nodes: [] })
        expect(draft![`${ROOM_ID}#Meta::Room`].positionGraph).toEqual({
            nodes: [
                { tag: 'Object', universalKey: TABLE_ID },
                { tag: 'Object', universalKey: TRAY_ID },
            ],
            edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' }],
        })

        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Moved', objectId: TRAY_ID, froms: [CHARACTER_ID], to: ROOM_ID }),
        }))
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Relation Changed', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID }),
        }))
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: TRAY_ID,
            containers: [ROOM_ID],
        })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: ROOM_ID })
    })

    it('aborts the whole transact --- no partial move, no partial relation, no fact streams --- when the subject is no longer on the source host at commit time', async () => {
        // Stale repair candidate: a concurrent command already moved the tray off the character
        // by commit time.
        const heldGraph = testPositionGraph(CHARACTER_ID, { nodes: [] })
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }] })
        const { transactWrite } = makeTransactWriteMock({ [CHARACTER_ID]: heldGraph, [ROOM_ID]: roomGraph })

        const result = await applyObjectRelationalChangeWithTransfer(
            {
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
                transferFromHostId: CHARACTER_ID,
            },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result).toMatchObject({ ok: false, errorCode: 'RELATIONAL_TRANSFER_TRANSACT_FAILED' })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).not.toHaveBeenCalled()
    })

    it('aborts the whole transact when the subject is already present on the destination host at commit time (stale candidate)', async () => {
        const heldGraph = testPositionGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
        // A concurrent command already placed a same-id object on the room by commit time --- the
        // repair candidate assumed an empty destination slot that's no longer true.
        const roomGraph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TABLE_ID },
                { tag: 'Object', universalKey: TRAY_ID },
            ],
        })
        const { transactWrite } = makeTransactWriteMock({ [CHARACTER_ID]: heldGraph, [ROOM_ID]: roomGraph })

        const result = await applyObjectRelationalChangeWithTransfer(
            {
                subjectId: TRAY_ID,
                targetId: TABLE_ID,
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
                transferFromHostId: CHARACTER_ID,
            },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result).toMatchObject({ ok: false, errorCode: 'RELATIONAL_TRANSFER_TRANSACT_FAILED' })
        expect(streamEvent).not.toHaveBeenCalled()
    })
})
