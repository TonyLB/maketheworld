import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { testPositionGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyObjectRelationalChange } from './applyObjectRelationalChange'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
            getLudicGraph: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import internalCache from '../../../../internalCache'

const BROOM_ID = 'OBJECT#Broom' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const roomGraphWithObjects = testPositionGraph(ROOM_ID, {
    nodes: [
        { tag: 'Object' as const, universalKey: BROOM_ID },
        { tag: 'Object' as const, universalKey: TABLE_ID },
    ],
})

/**
 * Simulates `transactWrite`'s `MultiKeyUpdate` handling, matching
 * `commitStepSequence.test.ts`'s convention.
 */
const makeTransactWriteMock = (graphsByHost: Record<string, EphemeraLudicGraph>) => {
    const transactWrite: any = jest.fn(async (items: any[]): Promise<void> => {
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        if (!multiKeyItem) {
            return
        }
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
            const graph = graphsByHost[key.EphemeraId]
            draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                EphemeraId: key.EphemeraId,
                DataCategory: key.DataCategory,
                ludicGraph: graph.toStored(),
            }
        })
        multiKeyItem.reducer(draft)
    })
    return transactWrite
}

describe('applyObjectRelationalChange', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('surfaces a kernel failure', async () => {
        const roomGraphMissingObjects = testPositionGraph(ROOM_ID, { nodes: [] })
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: roomGraphMissingObjects })

        const result = await applyObjectRelationalChange(
            {
                subjectId: BROOM_ID,
                targetId: TABLE_ID,
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result.ok).toBe(false)
        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('runs relational-changed bundle on successful establish', async () => {
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: roomGraphWithObjects })

        const result = await applyObjectRelationalChange(
            {
                subjectId: BROOM_ID,
                targetId: TABLE_ID,
                hostId: ROOM_ID,
                relationKind: 'On',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent, transactWrite }
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
        const characterGraph = testPositionGraph(CHARACTER_ID, {
            nodes: [
                { tag: 'Object' as const, universalKey: STRING_ID },
                { tag: 'Object' as const, universalKey: TOP_ID },
            ],
        })
        const transactWrite = makeTransactWriteMock({ [CHARACTER_ID]: characterGraph })

        const result = await applyObjectRelationalChange(
            {
                subjectId: STRING_ID,
                targetId: TOP_ID,
                hostId: CHARACTER_ID,
                relationKind: 'Custom',
                relationLabel: 'wrapped around',
                operation: 'establish',
            },
            { messageBus: messageBus as any, streamEvent, transactWrite }
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

    describe('BD-16 repaired (transferFromHostId present)', () => {
        const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId
        const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId

        it('BD-16 worked example: moves the tray from the character to the room and establishes the relation, atomically', async () => {
            const heldGraph = testPositionGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
            const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === CHARACTER_ID ? heldGraph : roomGraph
            )
            const transactWrite = makeTransactWriteMock({ [CHARACTER_ID]: heldGraph, [ROOM_ID]: roomGraph })

            const result = await applyObjectRelationalChange(
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

        it('BD-28: repairing the transfer severs a boundary relation left behind on the character and streams the dissolve fact first', async () => {
            const KEYRING_ID = 'OBJECT#Keyring' as EphemeraObjectId
            const heldGraph = testPositionGraph(CHARACTER_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: KEYRING_ID },
                ],
                edges: [{ tag: 'Relational', from: TRAY_ID, to: KEYRING_ID, kind: 'Against' }],
            })
            const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === CHARACTER_ID ? heldGraph : roomGraph
            )
            const transactWrite = makeTransactWriteMock({ [CHARACTER_ID]: heldGraph, [ROOM_ID]: roomGraph })

            await applyObjectRelationalChange(
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

            const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
            expect(eventTypes[0]).toBe('Object Relation Changed')
            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                update: expect.objectContaining({
                    type: 'Object Relation Changed',
                    subjectId: TRAY_ID,
                    targetId: KEYRING_ID,
                    operation: 'dissolve',
                }),
            }))
        })

        it('aborts the whole transact --- no partial move, no partial relation, no fact streams --- when the subject is no longer on the source host at commit time', async () => {
            const heldGraph = testPositionGraph(CHARACTER_ID, { nodes: [] })
            const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === CHARACTER_ID ? heldGraph : roomGraph
            )
            const transactWrite = makeTransactWriteMock({ [CHARACTER_ID]: heldGraph, [ROOM_ID]: roomGraph })

            const result = await applyObjectRelationalChange(
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

            expect(result.ok).toBe(false)
            expect(streamEvent).not.toHaveBeenCalled()
            expect(messageBus.publish).not.toHaveBeenCalled()
            expect(internalCache.Positions.setMembershipContainers).not.toHaveBeenCalled()
        })
    })
})
