import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { commitStepSequence } from './commitStepSequence'
import type { KernelStep } from './kernelStep'
import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'

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
const GLASS_ID = 'OBJECT#Glass' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Reuses the established `MultiKeyUpdate` unit-test pattern from `applyObjectSetTransfer.test.ts`:
 * builds a draft `Record` from `graphsByHost` and invokes the reducer directly, standing in for
 * whatever is actually in the database at the moment of commit.
 */
const makeTransactWriteMock = (graphsByHost: Record<string, EphemeraPositionGraph>) => {
    const lastItems: { current: any[] | undefined } = { current: undefined }
    const transactWrite: any = jest.fn(async (items: any[]): Promise<void> => {
        lastItems.current = items
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
    })
    return { transactWrite, lastItems }
}

describe('commitStepSequence', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('happy path: BD-13 carry+transfer sequence commits, positionGraph written back, facts stream in output order', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: GLASS_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [
                { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
                { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
            ],
        })
        const characterGraph = testPositionGraph(CHARACTER_ID, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph })

        const steps: KernelStep[] = [
            { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, relationKind: 'On' },
            { kind: 'transferMembership', entityIds: new Set([TRAY_ID, GLASS_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
        ]

        const result = await commitStepSequence(
            { steps },
            { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
        )

        expect(result.ok).toBe(true)
        expect(internalCache.Positions.set).toHaveBeenCalled()

        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Relation Changed', 'Object Moved', 'Object Moved'])

        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: ROOM_ID })
    })

    it('illegal/defer verdict from applyStepSequenceCore aborts the transact and returns ok:false', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [] }) // stale: tray not actually present
        const characterGraph = testPositionGraph(CHARACTER_ID, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph })

        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
        ]

        const result = await commitStepSequence(
            { steps },
            { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
        )

        expect(result).toEqual({
            ok: false,
            errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED',
            errorMessage: expect.stringContaining('staleTransferCandidate'),
        })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).not.toHaveBeenCalled()
    })

    it('a structural-invariant throw (BD-33 host mismatch) aborts identically to a verdict failure', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
        const otherRoomGraph = testPositionGraph('ROOM#Kitchen' as EphemeraRoomId, {
            nodes: [{ tag: 'Object', universalKey: GLASS_ID }],
        })
        const { transactWrite } = makeTransactWriteMock({
            [ROOM_ID]: roomGraph,
            'ROOM#Kitchen': otherRoomGraph,
        })

        const steps: KernelStep[] = [{ kind: 'establishRelation', subjectId: TRAY_ID, targetId: GLASS_ID, relationKind: 'On' }]

        const result = await commitStepSequence(
            {
                steps,
            },
            {
                messageBus: messageBus as any,
                streamEvent,
                getCurrentHost: (id) => (id === TRAY_ID ? ROOM_ID : ('ROOM#Kitchen' as EphemeraRoomId)),
                transactWrite,
            }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errorCode).toBe('STEP_SEQUENCE_TRANSACT_FAILED')
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('character-kind transfer commits correctly and emits no fact for the character subset', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] })
        const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
        const otherRoomGraph = testPositionGraph(otherRoomId, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [otherRoomId]: otherRoomGraph })

        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([CHARACTER_ID]), fromHostId: ROOM_ID, toHostId: otherRoomId },
        ]

        const result = await commitStepSequence(
            { steps },
            { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
        )

        expect(result.ok).toBe(true)
        expect(streamEvent).not.toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: CHARACTER_ID,
            containers: [otherRoomId],
        })
    })

    it('footprint precompute matches exactly the Keys passed to MultiKeyUpdate (no under- or over-locking)', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
        const characterGraph = testPositionGraph(CHARACTER_ID, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph })

        const steps: KernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostId: ROOM_ID, toHostId: CHARACTER_ID },
        ]

        await commitStepSequence(
            { steps },
            { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
        )

        const items = transactWrite.mock.calls[0][0]
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item).MultiKeyUpdate
        const keyedHosts = new Set(multiKeyItem.Keys.map((key: any) => key.EphemeraId))
        expect(keyedHosts).toEqual(new Set([ROOM_ID, CHARACTER_ID]))
    })
})
