import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { commitStepSequence } from './commitStepSequence'
import type { MutationKernelStep } from './kernelStep'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

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
const makeTransactWriteMock = (graphsByHost: Record<string, EphemeraLudicGraph>) => {
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
                ludicGraph: graph.toStored(),
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

    it('happy path: BD-13 carry+transfer sequence commits, ludicGraph written back, facts stream in output order', async () => {
        const roomGraph = testLudicGraph(ROOM_ID, {
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
        const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph })

        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, relationKind: 'On' },
            { kind: 'transferMembership', entityIds: new Set([TRAY_ID, GLASS_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
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
        const roomGraph = testLudicGraph(ROOM_ID, { nodes: [] }) // stale: tray not actually present
        const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph })

        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
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
        const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
        const otherRoomGraph = testLudicGraph('ROOM#Kitchen' as EphemeraRoomId, {
            nodes: [{ tag: 'Object', universalKey: GLASS_ID }],
        })
        const { transactWrite } = makeTransactWriteMock({
            [ROOM_ID]: roomGraph,
            'ROOM#Kitchen': otherRoomGraph,
        })

        const steps: MutationKernelStep[] = [{ kind: 'establishRelation', subjectId: TRAY_ID, targetId: GLASS_ID, relationKind: 'On' }]

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

    it('character-kind transfer commits correctly and streams a Character Moved fact for the character subset', async () => {
        const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] })
        const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
        const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [otherRoomId]: otherRoomGraph })

        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([CHARACTER_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: otherRoomId },
        ]

        const result = await commitStepSequence(
            { steps },
            {
                messageBus: messageBus as any,
                streamEvent,
                getCurrentHost: () => ROOM_ID,
                transactWrite,
                characterNames: new Map([[CHARACTER_ID, 'Alpha']]),
            }
        )

        expect(result.ok).toBe(true)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: CHARACTER_ID,
            header: { type: 'Character Moved' },
            update: expect.objectContaining({
                type: 'Character Moved',
                characterId: CHARACTER_ID,
                froms: [ROOM_ID],
                to: otherRoomId,
                characterName: 'Alpha',
            }),
        })
        // Character Moved streams before the kernel's own RoomUpdate publish loop, mirroring Object
        // Moved's existing ordering guarantee --- see factsForStep.ts's doc comment.
        expect(streamEvent.mock.invocationCallOrder[0]).toBeLessThan(messageBus.publish.mock.invocationCallOrder[0])
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: CHARACTER_ID,
            containers: [otherRoomId],
        })
    })

    it('footprint precompute matches exactly the Keys passed to MultiKeyUpdate (no under- or over-locking)', async () => {
        const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
        const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph })

        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
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

    it('MK2: an Object-hosted transfer commits through Meta::Object, not Meta::Character', async () => {
        const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: GLASS_ID }] })
        const trayHostGraph = testLudicGraph(TRAY_ID, { nodes: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [TRAY_ID]: trayHostGraph })

        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([GLASS_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: TRAY_ID },
        ]

        const result = await commitStepSequence(
            { steps },
            { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
        )

        expect(result.ok).toBe(true)

        const items = transactWrite.mock.calls[0][0]
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item).MultiKeyUpdate
        const trayKey = multiKeyItem.Keys.find((key: any) => key.EphemeraId === TRAY_ID)
        expect(trayKey.DataCategory).toBe('Meta::Object')
    })

    describe('object-lifecycle Migrate row: pure remove, suppressRelationalFacts', () => {
        it('destroy-shaped sequence (explicit dissolve + pure remove) commits, streams the dissolve fact, adjacency Delete-only', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
                edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' }],
            })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, relationKind: 'On' },
                { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: null },
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)

            const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
            expect(eventTypes).toEqual(['Object Relation Changed', 'Object Moved'])

            const movedUpdate = streamEvent.mock.calls.map(([payload]: any[]) => payload.update)
                .find((update: any) => update.type === 'Object Moved')
            expect(movedUpdate).toEqual(
                expect.objectContaining({ objectId: TRAY_ID, froms: [ROOM_ID], to: null })
            )

            const items = transactWrite.mock.calls[0][0]
            const adjacencyItems = items.filter((item: any) => 'Delete' in item || 'Put' in item)
            expect(adjacencyItems).toEqual([{ Delete: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(ROOM_ID) } }])
        })

        it('suppressRelationalFacts: true suppresses only the Object Relation Changed fact, Object Moved still streams', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
                edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' }],
            })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, relationKind: 'On' },
                { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: null },
            ]

            const result = await commitStepSequence(
                { steps },
                {
                    messageBus: messageBus as any,
                    streamEvent,
                    getCurrentHost: () => ROOM_ID,
                    transactWrite,
                    suppressRelationalFacts: true,
                }
            )

            expect(result.ok).toBe(true)
            const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
            expect(eventTypes).toEqual(['Object Moved'])
        })

        it('pure add (spawn-shaped, fromHostIds empty): adds to destination, adjacency Put-only, no dissolve needed', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostIds: new Set(), toHostId: ROOM_ID },
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            const items = transactWrite.mock.calls[0][0]
            const adjacencyItems = items.filter((item: any) => 'Delete' in item || 'Put' in item)
            expect(adjacencyItems).toEqual([{ Put: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(ROOM_ID) } }])
        })

        it('character-only pure remove (disconnect-shaped, toHostId null): commits, adjacency Delete-only, streams Character Moved with to: null', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([CHARACTER_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: null },
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                header: { type: 'Character Moved' },
                update: expect.objectContaining({ froms: [ROOM_ID], to: null }),
            }))
            const items = transactWrite.mock.calls[0][0]
            const adjacencyItems = items.filter((item: any) => 'Delete' in item || 'Put' in item)
            expect(adjacencyItems).toEqual([{ Delete: { EphemeraId: CHARACTER_ID, DataCategory: expect.stringContaining(ROOM_ID) } }])
        })

        it('character-only pure add (connect-from-nowhere-shaped, fromHostIds empty): commits, adjacency Put-only, streams Character Moved with froms: []', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'transferMembership', entityIds: new Set([CHARACTER_ID]), fromHostIds: new Set(), toHostId: ROOM_ID },
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                header: { type: 'Character Moved' },
                update: expect.objectContaining({ froms: [], to: ROOM_ID }),
            }))
            const items = transactWrite.mock.calls[0][0]
            const adjacencyItems = items.filter((item: any) => 'Delete' in item || 'Put' in item)
            expect(adjacencyItems).toEqual([{ Put: { EphemeraId: CHARACTER_ID, DataCategory: expect.stringContaining(ROOM_ID) } }])
        })
    })

    describe('capture step (PB-J)', () => {
        it('a legal commit returns the captured roster keyed by captureId', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] })
            const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [otherRoomId]: otherRoomGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: ROOM_ID, captureId: 'departure' },
                { kind: 'transferMembership', entityIds: new Set([CHARACTER_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: otherRoomId },
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.captures.get('departure')).toEqual([CHARACTER_ID])
        })

        it('a capture naming a host no mutation step touches still locks that host into the footprint', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }] })
            const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
            const otherRoomGraph = testLudicGraph(otherRoomId, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [otherRoomId]: otherRoomGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: otherRoomId, captureId: 'onlooker' },
                { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: null },
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.captures.get('onlooker')).toEqual([CHARACTER_ID])

            const items = transactWrite.mock.calls[0][0]
            const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item).MultiKeyUpdate
            const keyedHosts = new Set(multiKeyItem.Keys.map((key: any) => key.EphemeraId))
            expect(keyedHosts).toEqual(new Set([ROOM_ID, otherRoomId]))
        })

        it('an illegal commit discards captures entirely', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [] }) // stale: tray not actually present
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph })

            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: ROOM_ID, captureId: 'departure' },
                { kind: 'transferMembership', entityIds: new Set([TRAY_ID]), fromHostIds: new Set([ROOM_ID]), toHostId: CHARACTER_ID },
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(false)
        })

        it('PB-D: a forced reducer retry does not duplicate the captured roster', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] })
            let attempt = 0
            const transactWrite: any = jest.fn(async (items: any[]) => {
                const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
                const draft: Record<string, any> = {}
                multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
                    draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                        EphemeraId: key.EphemeraId,
                        DataCategory: key.DataCategory,
                        ludicGraph: roomGraph.toStored(),
                    }
                })
                multiKeyItem.reducer(draft)
                attempt += 1
                if (attempt === 1) {
                    const error: any = new Error('stale --- retry')
                    error.errorType = 'TransactionCanceledException'
                    throw error
                }
            })

            const steps: MutationKernelStep[] = [{ kind: 'capture', hostId: ROOM_ID, captureId: 'before' }]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(transactWrite).toHaveBeenCalledTimes(2)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.captures.size).toBe(1)
            expect(result.captures.get('before')).toEqual([CHARACTER_ID])
        })
    })
})
