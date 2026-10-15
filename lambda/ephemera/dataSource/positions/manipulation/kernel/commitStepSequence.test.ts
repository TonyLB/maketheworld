import { produce } from 'immer'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { commitStepSequence } from './commitStepSequence'
import type { MutationKernelStep } from './kernelStep'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { graphFromMeta } from '../../ludicGraph'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            set: jest.fn(),
            invalidate: jest.fn(),
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

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const GLASS_ID = 'OBJECT#Glass' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/** The facts a step sequence streams, leaving out the `Ludic Cache Invalidated` the commit adds (tested on its own). */
const stepFactCalls = (streamEvent: jest.Mock): any[][] => streamEvent.mock.calls.filter(([payload]: any[]) => payload.header.type !== 'Ludic Cache Invalidated')
/** The cascade's rows beyond the room markers' bumps. */
const withoutMarkerBumps = (items: any[] | undefined) => items?.filter((item) => !('PrimitiveUpdate' in item))

const remainder = (host: EphemeraMembershipHostId) => ({ host, presence: parentRemainderKey(host) })
/** A binding move of `mover`'s binding `name` between hosts (`from: null` is a first placement). */
const move = (mover: EphemeraMembershipHostId, name: string, from: EphemeraMembershipHostId | null, to: EphemeraMembershipHostId): MutationKernelStep => (
    { kind: 'movePresenceBinding', hostId: mover, presence: `PRESENCE#${name}` as any, from: from ? remainder(from) : null, to: remainder(to) }
)
const release = (mover: EphemeraMembershipHostId, name: string, from: EphemeraMembershipHostId): MutationKernelStep => (
    { kind: 'releasePresenceBinding', hostId: mover, presence: `PRESENCE#${name}` as any, from: remainder(from) }
)
/** The mover's own graph, holding one binding `name` under `host` (hostless without one). */
const moverGraph = (mover: EphemeraMembershipHostId, host?: EphemeraMembershipHostId, name = 'p1') => (
    testLudicGraph(mover, { nodes: [presenceBindingNode(name, host)] })
)
const withRemainder = (host: EphemeraMembershipHostId, ...held: any[]) => testLudicGraph(host, { nodes: [...held, presenceBindingNode(parentRemainderKey(host))] })

/**
 * Reuses the established `MultiKeyUpdate` unit-test pattern from `applyObjectSetTransfer.test.ts`:
 * builds a draft `Record` from `graphsByHost` and invokes the reducer directly, standing in for
 * whatever is actually in the database at the moment of commit.
 */
const makeTransactWriteMock = (graphsByHost: Record<string, EphemeraLudicGraph>) => {
    // the pre-commit graphs the kernel reads to resolve the rooms it stales; a host with no entry holds nothing
    ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(
        async (hostId: EphemeraMembershipHostId) => graphsByHost[hostId] ?? testLudicGraph(hostId, { nodes: [] })
    )
    const lastItems: { current: any[] | undefined } = { current: undefined }
    // what the wrapper's `cascade` hook returned, i.e. the extra items it would append to the call
    const cascadeItems: { current: any[] | undefined } = { current: undefined }
    // the draft after the reducer ran: a key the reducer removed is the wrapper's cue to emit a `Delete`
    const lastDraft: { current: Record<string, any> | undefined } = { current: undefined }
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
        const prior = structuredClone(draft)
        // real Immer, as the wrapper runs it: every draft proxy is revoked when the reducer returns, so anything the
        // reducer retains for the cascade or the post-persist code must be plain
        const next = produce(draft, multiKeyItem.reducer)
        lastDraft.current = next
        cascadeItems.current = multiKeyItem.cascade?.(prior, next)
    })
    return { transactWrite, lastItems, cascadeItems, lastDraft }
}

describe('commitStepSequence', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('a split', () => {
        const PLANK = 'OBJECT#Plank' as EphemeraObjectId
        const CUP = 'OBJECT#Cup' as EphemeraObjectId
        const BOOK = 'OBJECT#Book' as EphemeraObjectId
        const OTHER_ROOM = 'ROOM#Terrace' as EphemeraRoomId

        it('locks the re-pointed child (not the original binding\'s children) and persists the re-pointed pointer', async () => {
            const cupEntry = { host: CUP, presence: 'PRESENCE#cup1' as const }
            const bookEntry = { host: BOOK, presence: 'PRESENCE#book1' as const }
            const under = { host: PLANK, presence: 'PRESENCE#B' as const }
            const graphs = {
                [PLANK]: testLudicGraph(PLANK, { nodes: [{ tag: 'Object', universalKey: PLANK }, presenceBindingNode('B', ROOM_ID, { members: [cupEntry, bookEntry, { tag: 'Remainder' }] })] }),
                [BOOK]: testLudicGraph(BOOK, { nodes: [presenceBindingNode('book1', under)] }),
                [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: PLANK }, presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
                [OTHER_ROOM]: testLudicGraph(OTHER_ROOM, { nodes: [presenceBindingNode(parentRemainderKey(OTHER_ROOM))] }),
            }
            const { transactWrite, lastItems, lastDraft } = makeTransactWriteMock(graphs)
            const steps: MutationKernelStep[] = [{
                kind: 'splitPresenceBinding',
                hostId: PLANK,
                presence: 'PRESENCE#B' as any,
                splitInto: [
                    { presence: 'PRESENCE#B' as any, cover: { members: [cupEntry, { tag: 'Remainder' }] } },
                    { presence: 'PRESENCE#B2' as any, cover: { members: [bookEntry] } },
                ],
            }, {
                // the new binding shares the original's parent, which a run may not leave behind
                kind: 'movePresenceBinding',
                hostId: PLANK,
                presence: 'PRESENCE#B2' as any,
                from: { host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) },
                to: { host: OTHER_ROOM, presence: parentRemainderKey(OTHER_ROOM) },
            }]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite }
            )

            expect(result.ok).toBe(true)
            const locked = lastItems.current!.find((item) => 'MultiKeyUpdate' in item).MultiKeyUpdate.Keys.map((key: { EphemeraId: string }) => key.EphemeraId)
            expect(new Set(locked)).toEqual(new Set([PLANK, BOOK, ROOM_ID, OTHER_ROOM]))
            const bookRow = Object.values(lastDraft.current!).find((row: any) => row.EphemeraId === BOOK) as any
            expect(graphFromMeta(bookRow, BOOK).presenceNodes[0].fromHostPresence).toEqual({ host: PLANK, presence: 'PRESENCE#B2' })
        })
    })

    describe('membership counts bindings', () => {
        const OTHER_ROOM = 'ROOM#Terrace' as EphemeraRoomId
        const DEST_ROOM = 'ROOM#Garden' as EphemeraRoomId

        it('writes the adjacency row only for hosts whose membership changed: one of two bindings leaves, the other host keeps its row', async () => {
            const graphs = {
                [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
                [OTHER_ROOM]: testLudicGraph(OTHER_ROOM, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode(parentRemainderKey(OTHER_ROOM))] }),
                [DEST_ROOM]: testLudicGraph(DEST_ROOM, { nodes: [presenceBindingNode(parentRemainderKey(DEST_ROOM))] }),
                [TRAY_ID]: testLudicGraph(TRAY_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode('tray-a', ROOM_ID), presenceBindingNode('tray-b', OTHER_ROOM)] }),
            }
            const { transactWrite, cascadeItems } = makeTransactWriteMock(graphs)
            const steps: MutationKernelStep[] = [
                move(TRAY_ID, 'tray-a', ROOM_ID, DEST_ROOM),
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(withoutMarkerBumps(cascadeItems.current)).toEqual([
                { Delete: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(ROOM_ID) } },
                { Put: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(DEST_ROOM) } },
            ])
            // the cache lists every host a binding still points at, not only the destination
            expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
                componentId: TRAY_ID,
                containers: [DEST_ROOM, OTHER_ROOM],
            })
        })

        it('writes no adjacency row for a departure from a host where another binding of the mover remains', async () => {
            const graphs = {
                [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
                [DEST_ROOM]: testLudicGraph(DEST_ROOM, { nodes: [presenceBindingNode(parentRemainderKey(DEST_ROOM))] }),
                [TRAY_ID]: testLudicGraph(TRAY_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode('tray-a', ROOM_ID), presenceBindingNode('tray-b', ROOM_ID)] }),
            }
            const { transactWrite, cascadeItems } = makeTransactWriteMock(graphs)
            const steps: MutationKernelStep[] = [
                move(TRAY_ID, 'tray-a', ROOM_ID, DEST_ROOM),
            ]

            await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite }
            )

            expect(withoutMarkerBumps(cascadeItems.current)).toEqual([
                { Put: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(DEST_ROOM) } },
            ])
        })
    })

    describe('destroyComponent', () => {
        const destroyTray: MutationKernelStep = { kind: 'destroyComponent', hostId: TRAY_ID }
        const pairDelete = { Delete: { EphemeraId: TRAY_ID, DataCategory: 'ASSET#IMPROVISATION' } }

        it('removes the destroyed host from the draft, so the wrapper deletes its row; the room is updated, not the tray', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode(parentRemainderKey(ROOM_ID))] })
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [presenceBindingNode('p1', ROOM_ID)] })
            const { transactWrite, lastItems, cascadeItems, lastDraft } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [TRAY_ID]: trayGraph })
            const steps: MutationKernelStep[] = [
                release(TRAY_ID, 'p1', ROOM_ID),
                destroyTray,
            ]

            const result = await commitStepSequence(
                { steps, existenceItems: [pairDelete] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite }
            )

            expect(result.ok).toBe(true)
            const multiKeyItem = lastItems.current!.find((item) => 'MultiKeyUpdate' in item).MultiKeyUpdate
            expect(multiKeyItem.Keys).toEqual(expect.arrayContaining([
                { EphemeraId: TRAY_ID, DataCategory: 'Meta::Object' },
                { EphemeraId: ROOM_ID, DataCategory: 'Meta::Room' },
            ]))
            expect(Object.keys(lastDraft.current!)).toEqual([`${ROOM_ID}#Meta::Room`])
            // adjacency row for the departure rides along; the host's own memo is dropped
            expect(withoutMarkerBumps(cascadeItems.current)).toEqual([
                { Delete: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(ROOM_ID) } },
                pairDelete,
            ])
            expect(internalCache.Positions.invalidate).toHaveBeenCalledWith(TRAY_ID)
            expect(internalCache.Positions.set).not.toHaveBeenCalledWith(expect.objectContaining({ hostId: TRAY_ID }))
        })

        it('an orphan (no move) is destroyed alone, and afterPersist runs before any fact streams', async () => {
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [presenceBindingNode('born')] })
            const { transactWrite, lastDraft } = makeTransactWriteMock({ [TRAY_ID]: trayGraph })
            const afterPersist = jest.fn()

            const result = await commitStepSequence(
                { steps: [destroyTray], existenceItems: [pairDelete] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite, afterPersist }
            )

            expect(result.ok).toBe(true)
            expect(lastDraft.current).toEqual({})
            expect(afterPersist).toHaveBeenCalledTimes(1)
            expect(transactWrite.mock.invocationCallOrder[0]).toBeLessThan(afterPersist.mock.invocationCallOrder[0])
        })

        it('a host still holding an Object aborts the commit: nothing is deleted and afterPersist never runs', async () => {
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [{ tag: 'Object', universalKey: GLASS_ID }, presenceBindingNode('born')] })
            const { transactWrite, cascadeItems } = makeTransactWriteMock({ [TRAY_ID]: trayGraph })
            const afterPersist = jest.fn()
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            const result = await commitStepSequence(
                { steps: [destroyTray], existenceItems: [pairDelete] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite, afterPersist }
            )

            expect(result).toEqual(expect.objectContaining({ ok: false, errorMessage: expect.stringContaining('still holds') }))
            expect(cascadeItems.current).toBeUndefined()
            expect(afterPersist).not.toHaveBeenCalled()
            expect(internalCache.Positions.invalidate).not.toHaveBeenCalled()
            consoleSpy.mockRestore()
        })
    })

    describe('createComponent', () => {
        const createTray: MutationKernelStep = {
            kind: 'createComponent',
            hostId: TRAY_ID,
            presenceUuid: 'born',
            meta: { EphemeraId: TRAY_ID, DataCategory: 'Meta::Object', stableKey: 'tray' },
        }
        const placeTray: MutationKernelStep[] = [move(TRAY_ID, 'born', null, ROOM_ID)]
        const pairItem = { Put: { EphemeraId: TRAY_ID, DataCategory: 'ASSET#IMPROVISATION', tag: 'Object', shortName: 'tray' } }

        it('leaves the created host out of the fetched keys and writes it, with existenceItems, through cascade', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode(parentRemainderKey(ROOM_ID))] })
            const { transactWrite, lastItems, cascadeItems } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            const result = await commitStepSequence(
                { steps: [createTray, ...placeTray], existenceItems: [pairItem] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(transactWrite).toHaveBeenCalledTimes(1)
            const multiKeyItem = lastItems.current!.find((item) => 'MultiKeyUpdate' in item).MultiKeyUpdate
            expect(multiKeyItem.Keys).toEqual([{ EphemeraId: ROOM_ID, DataCategory: 'Meta::Room' }])
            expect(withoutMarkerBumps(cascadeItems.current)).toEqual([
                {
                    Put: {
                        EphemeraId: TRAY_ID,
                        DataCategory: 'Meta::Object',
                        stableKey: 'tray',
                        ludicGraph: expect.objectContaining({
                            nodes: expect.arrayContaining([presenceBindingNode('born', ROOM_ID)]),
                        }),
                    },
                },
                { Put: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(ROOM_ID) } },
                pairItem,
            ])
            const storedNodes = cascadeItems.current![0].Put.ludicGraph.nodes
            expect(storedNodes.filter((node: { tag: string }) => node.tag === 'Presence')).toHaveLength(1)
        })

        it('runs afterPersist after the write and before any fact streams', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode(parentRemainderKey(ROOM_ID))] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })
            const afterPersist = jest.fn()

            await commitStepSequence(
                { steps: [createTray, ...placeTray] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite, afterPersist }
            )

            expect(afterPersist).toHaveBeenCalledTimes(1)
            expect(streamEvent).toHaveBeenCalled()
            expect(transactWrite.mock.invocationCallOrder[0]).toBeLessThan(afterPersist.mock.invocationCallOrder[0])
            expect(afterPersist.mock.invocationCallOrder[0]).toBeLessThan(streamEvent.mock.invocationCallOrder[0])
        })

        it('a refused placement writes nothing: the reducer throws before cascade, and afterPersist never runs', async () => {
            const { transactWrite, cascadeItems } = makeTransactWriteMock({
                // the room holds no binding to land under, so the placement is stale
                [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [] }),
            })
            const afterPersist = jest.fn()
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

            const result = await commitStepSequence(
                { steps: [createTray, ...placeTray], existenceItems: [pairItem] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite, afterPersist }
            )

            expect(result.ok).toBe(false)
            expect(cascadeItems.current).toBeUndefined()
            expect(afterPersist).not.toHaveBeenCalled()
            consoleSpy.mockRestore()
        })
    })

    it('happy path: dissolve+move sequence commits, ludicGraph written back, facts stream in output order', async () => {
        const roomGraph = testLudicGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [
                { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Custom', relationLabel: 'tied to' },
            ],
        })
        const characterGraph = withRemainder(CHARACTER_ID)
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })

        const steps: MutationKernelStep[] = [
            { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID, relationKind: 'Custom', relationLabel: 'tied to' },
            move(TRAY_ID, 'p1', ROOM_ID, CHARACTER_ID),
        ]

        const result = await commitStepSequence(
            { steps },
            { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
        )

        expect(result.ok).toBe(true)
        expect(internalCache.Positions.set).toHaveBeenCalled()

        const eventTypes = stepFactCalls(streamEvent).map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Relation Changed', 'Object Moved'])

        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: ROOM_ID })
    })

    it('illegal/defer verdict from applyStepSequenceCore aborts the transact and returns ok:false', async () => {
        const roomGraph = withRemainder(ROOM_ID) // stale: tray not actually present
        const characterGraph = withRemainder(CHARACTER_ID)
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })

        const steps: MutationKernelStep[] = [move(TRAY_ID, 'p1', ROOM_ID, CHARACTER_ID)]

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

        const steps: MutationKernelStep[] = [{ kind: 'establishRelation', subjectId: TRAY_ID, targetId: GLASS_ID, hostId: ROOM_ID, relationKind: 'On' }]

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

    describe('the rooms\' characters rows', () => {
        const KITCHEN = 'ROOM#Kitchen' as EphemeraRoomId
        const BETA_ID = 'CHARACTER#Beta' as EphemeraCharacterId
        const charactersRowItems = (items: any[] | undefined) => items?.filter((item) => item.PrimitiveUpdate?.Key.DataCategory === 'LudicCache::Characters').map((item) => item.PrimitiveUpdate)
        const commit = (steps: MutationKernelStep[], graphs: Record<string, EphemeraLudicGraph>) => {
            const { transactWrite, cascadeItems } = makeTransactWriteMock(graphs)
            return commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            ).then((result) => ({ result, cascadeItems }))
        }

        it('removes the character from the room it left and sets it, with its own binding ids, in the room it arrived at', async () => {
            const { result, cascadeItems } = await commit([move(CHARACTER_ID, 'p1', ROOM_ID, KITCHEN)], {
                [ROOM_ID]: withRemainder(ROOM_ID, { tag: 'Character', universalKey: CHARACTER_ID }),
                [KITCHEN]: withRemainder(KITCHEN),
                [CHARACTER_ID]: moverGraph(CHARACTER_ID, ROOM_ID),
            })

            expect(result.ok).toBe(true)
            expect(charactersRowItems(cascadeItems.current)).toEqual([
                {
                    Key: { EphemeraId: ROOM_ID, DataCategory: 'LudicCache::Characters' },
                    ProjectionFields: [],
                    UpdateExpression: 'REMOVE #r0',
                    ExpressionAttributeNames: { '#r0': CHARACTER_ID },
                },
                {
                    Key: { EphemeraId: KITCHEN, DataCategory: 'LudicCache::Characters' },
                    ProjectionFields: [],
                    UpdateExpression: 'SET #c0 = :b0',
                    ExpressionAttributeNames: { '#c0': CHARACTER_ID },
                    ExpressionAttributeValues: { ':b0': ['PRESENCE#p1'] },
                },
            ])
        })

        it('writes one item per room even when two characters pass through it in one commit', async () => {
            const { result, cascadeItems } = await commit([
                move(CHARACTER_ID, 'p1', ROOM_ID, KITCHEN),
                move(BETA_ID, 'p2', ROOM_ID, KITCHEN),
            ], {
                [ROOM_ID]: withRemainder(ROOM_ID, { tag: 'Character', universalKey: CHARACTER_ID }, { tag: 'Character', universalKey: BETA_ID }),
                [KITCHEN]: withRemainder(KITCHEN),
                [CHARACTER_ID]: moverGraph(CHARACTER_ID, ROOM_ID, 'p1'),
                [BETA_ID]: moverGraph(BETA_ID, ROOM_ID, 'p2'),
            })

            expect(result.ok).toBe(true)
            const items = charactersRowItems(cascadeItems.current)!
            // a transaction may not name one item twice
            expect(items.map(({ Key }) => Key.EphemeraId).sort()).toEqual([KITCHEN, ROOM_ID].sort())
            expect(items.find(({ Key }) => Key.EphemeraId === ROOM_ID)).toEqual(expect.objectContaining({
                UpdateExpression: 'REMOVE #r0, #r1',
                ExpressionAttributeNames: { '#r0': CHARACTER_ID, '#r1': BETA_ID },
            }))
            expect(items.find(({ Key }) => Key.EphemeraId === KITCHEN)).toEqual(expect.objectContaining({
                UpdateExpression: 'SET #c0 = :b0, #c1 = :b1',
                ExpressionAttributeNames: { '#c0': CHARACTER_ID, '#c1': BETA_ID },
                ExpressionAttributeValues: { ':b0': ['PRESENCE#p1'], ':b1': ['PRESENCE#p2'] },
            }))
        })

        it('writes no characters row for an object move', async () => {
            const { cascadeItems } = await commit([move(TRAY_ID, 'p1', ROOM_ID, KITCHEN)], {
                [ROOM_ID]: withRemainder(ROOM_ID, { tag: 'Object', universalKey: TRAY_ID }),
                [KITCHEN]: withRemainder(KITCHEN),
                [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID),
            })

            expect(charactersRowItems(cascadeItems.current)).toEqual([])
        })
    })

    it('a character move commits correctly and streams a Character Moved fact for the character subset', async () => {
        const roomGraph = withRemainder(ROOM_ID, { tag: 'Character', universalKey: CHARACTER_ID })
        const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
        const otherRoomGraph = withRemainder(otherRoomId)
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [otherRoomId]: otherRoomGraph, [CHARACTER_ID]: moverGraph(CHARACTER_ID, ROOM_ID) })

        const steps: MutationKernelStep[] = [move(CHARACTER_ID, 'p1', ROOM_ID, otherRoomId)]

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
        const roomGraph = withRemainder(ROOM_ID, { tag: 'Object', universalKey: TRAY_ID })
        const characterGraph = withRemainder(CHARACTER_ID)
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })

        const steps: MutationKernelStep[] = [move(TRAY_ID, 'p1', ROOM_ID, CHARACTER_ID)]

        await commitStepSequence(
            { steps },
            { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
        )

        const items = transactWrite.mock.calls[0][0]
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item).MultiKeyUpdate
        const keyedHosts = new Set(multiKeyItem.Keys.map((key: any) => key.EphemeraId))
        expect(keyedHosts).toEqual(new Set([TRAY_ID, ROOM_ID, CHARACTER_ID]))
    })

    it('MK2: an Object-hosted move commits through Meta::Object, not Meta::Character', async () => {
        const roomGraph = withRemainder(ROOM_ID, { tag: 'Object', universalKey: GLASS_ID })
        const trayHostGraph = withRemainder(TRAY_ID)
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [TRAY_ID]: trayHostGraph, [GLASS_ID]: moverGraph(GLASS_ID, ROOM_ID) })

        const steps: MutationKernelStep[] = [move(GLASS_ID, 'p1', ROOM_ID, TRAY_ID)]

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

    describe('object-lifecycle Migrate row: release, first placement, suppressRelationalFacts', () => {
        it('destroy-shaped sequence (explicit dissolve + release) commits, streams the dissolve fact, adjacency Delete-only', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
                edges: [{ tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' }],
            })
            const { transactWrite, cascadeItems } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })

            const steps: MutationKernelStep[] = [
                { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID, relationKind: 'On' },
                release(TRAY_ID, 'p1', ROOM_ID),
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)

            const eventTypes = stepFactCalls(streamEvent).map(([payload]: any[]) => payload.header.type)
            expect(eventTypes).toEqual(['Object Relation Changed', 'Object Moved'])

            const movedUpdate = stepFactCalls(streamEvent).map(([payload]: any[]) => payload.update)
                .find((update: any) => update.type === 'Object Moved')
            expect(movedUpdate).toEqual(
                expect.objectContaining({ objectId: TRAY_ID, froms: [ROOM_ID], to: null })
            )

            // adjacency rows come from the committed graphs, through the wrapper's `cascade`
            const adjacencyItems = cascadeItems.current!.filter((item: any) => 'Delete' in item || 'Put' in item)
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
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })

            const steps: MutationKernelStep[] = [
                { kind: 'dissolveRelation', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID, relationKind: 'On' },
                release(TRAY_ID, 'p1', ROOM_ID),
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
            const eventTypes = stepFactCalls(streamEvent).map(([payload]: any[]) => payload.header.type)
            expect(eventTypes).toEqual(['Object Moved'])
        })

        it('first placement (spawn-shaped, from null): adds to destination, adjacency Put-only, no dissolve needed', async () => {
            const roomGraph = withRemainder(ROOM_ID)
            const { transactWrite, cascadeItems } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [TRAY_ID]: moverGraph(TRAY_ID) })

            const steps: MutationKernelStep[] = [move(TRAY_ID, 'p1', null, ROOM_ID)]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            // adjacency rows come from the committed graphs, through the wrapper's `cascade`
            const adjacencyItems = cascadeItems.current!.filter((item: any) => 'Delete' in item || 'Put' in item)
            expect(adjacencyItems).toEqual([{ Put: { EphemeraId: TRAY_ID, DataCategory: expect.stringContaining(ROOM_ID) } }])
        })

        it('character release (disconnect-shaped): commits, adjacency Delete-only, streams Character Moved with to: null', async () => {
            const roomGraph = withRemainder(ROOM_ID, { tag: 'Character', universalKey: CHARACTER_ID })
            const { transactWrite, cascadeItems } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: moverGraph(CHARACTER_ID, ROOM_ID) })

            const steps: MutationKernelStep[] = [release(CHARACTER_ID, 'p1', ROOM_ID)]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                header: { type: 'Character Moved' },
                update: expect.objectContaining({ froms: [ROOM_ID], to: null }),
            }))
            // adjacency rows come from the committed graphs, through the wrapper's `cascade`
            const adjacencyItems = cascadeItems.current!.filter((item: any) => 'Delete' in item || 'Put' in item)
            expect(adjacencyItems).toEqual([{ Delete: { EphemeraId: CHARACTER_ID, DataCategory: expect.stringContaining(ROOM_ID) } }])
        })

        it('character first placement (connect-from-nowhere-shaped): commits, adjacency Put-only, streams Character Moved with froms: []', async () => {
            const roomGraph = withRemainder(ROOM_ID)
            const { transactWrite, cascadeItems } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: moverGraph(CHARACTER_ID) })

            const steps: MutationKernelStep[] = [move(CHARACTER_ID, 'p1', null, ROOM_ID)]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                header: { type: 'Character Moved' },
                update: expect.objectContaining({ froms: [], to: ROOM_ID }),
            }))
            // adjacency rows come from the committed graphs, through the wrapper's `cascade`
            const adjacencyItems = cascadeItems.current!.filter((item: any) => 'Delete' in item || 'Put' in item)
            expect(adjacencyItems).toEqual([{ Put: { EphemeraId: CHARACTER_ID, DataCategory: expect.stringContaining(ROOM_ID) } }])
        })
    })

    describe('relationalEdges: one fact per edge', () => {
        // string sits in the room; cup sits on the table, whose own graph holds it.
        const STRING_ID = 'OBJECT#String' as EphemeraObjectId
        const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
        const tie = { relationKind: 'Custom' as const, relationLabel: 'tied to' }
        const port = { owner: TABLE_ID, port: 'p1' }
        const crossingSteps: MutationKernelStep[] = [
            { kind: 'addCrossingPort', hostId: TABLE_ID, port: { portId: 'p1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'tied to' } },
            { kind: 'establishRelation', subjectId: port, targetId: CUP_ID, hostId: TABLE_ID, ...tie },
            { kind: 'establishRelation', subjectId: STRING_ID, targetId: port, hostId: ROOM_ID, ...tie },
        ]
        const crossingGraphs = () => ({
            [ROOM_ID]: testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: STRING_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
            }),
            [TABLE_ID]: testLudicGraph(TABLE_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TABLE_ID },
                    { tag: 'Object', universalKey: CUP_ID },
                ],
            }),
        })
        const hostOf = (id: unknown) => (id === CUP_ID ? TABLE_ID : ROOM_ID)

        it('a crossing tie streams exactly one Object Relation Changed, naming the string and the cup', async () => {
            const { transactWrite } = makeTransactWriteMock(crossingGraphs())

            const result = await commitStepSequence(
                { steps: crossingSteps },
                {
                    messageBus: messageBus as any,
                    streamEvent,
                    getCurrentHost: hostOf as any,
                    transactWrite,
                    relationalEdges: [{ subjectId: STRING_ID, targetId: CUP_ID, operation: 'establish', ...tie }],
                }
            )

            expect(result).toEqual(expect.objectContaining({ ok: true }))
            const updates = stepFactCalls(streamEvent).map(([payload]: any[]) => payload.update)
            expect(updates).toEqual([
                expect.objectContaining({
                    type: 'Object Relation Changed',
                    subjectId: STRING_ID,
                    targetId: CUP_ID,
                    hostId: ROOM_ID,
                    operation: 'establish',
                    ...tie,
                }),
            ])
        })

        it('a one-leg relation with its edge supplied streams one fact, as without it', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
            })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            const result = await commitStepSequence(
                { steps: [{ kind: 'establishRelation', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID, ...tie }] },
                {
                    messageBus: messageBus as any,
                    streamEvent,
                    getCurrentHost: () => ROOM_ID,
                    transactWrite,
                    relationalEdges: [{ subjectId: TRAY_ID, targetId: TABLE_ID, operation: 'establish', ...tie }],
                }
            )

            expect(result.ok).toBe(true)
            const updates = stepFactCalls(streamEvent).map(([payload]: any[]) => payload.update)
            expect(updates).toEqual([
                expect.objectContaining({ type: 'Object Relation Changed', subjectId: TRAY_ID, targetId: TABLE_ID, hostId: ROOM_ID }),
            ])
        })

        it('a containment step no supplied edge covers still streams its own fact, in step order', async () => {
            const { transactWrite } = makeTransactWriteMock(crossingGraphs())

            const result = await commitStepSequence(
                {
                    steps: [
                        { kind: 'establishRelation', subjectId: CUP_ID, targetId: TABLE_ID, hostId: TABLE_ID, relationKind: 'On' },
                        ...crossingSteps,
                    ],
                },
                {
                    messageBus: messageBus as any,
                    streamEvent,
                    getCurrentHost: hostOf as any,
                    transactWrite,
                    relationalEdges: [{ subjectId: STRING_ID, targetId: CUP_ID, operation: 'establish', ...tie }],
                }
            )

            expect(result.ok).toBe(true)
            const updates = stepFactCalls(streamEvent).map(([payload]: any[]) => payload.update)
            expect(updates).toEqual([
                expect.objectContaining({ type: 'Object Relation Changed', subjectId: CUP_ID, targetId: TABLE_ID, relationKind: 'On' }),
                expect.objectContaining({ type: 'Object Relation Changed', subjectId: STRING_ID, targetId: CUP_ID, ...tie }),
            ])
        })

        it('suppressRelationalFacts suppresses the edge\'s fact too', async () => {
            const { transactWrite } = makeTransactWriteMock(crossingGraphs())

            const result = await commitStepSequence(
                { steps: crossingSteps },
                {
                    messageBus: messageBus as any,
                    streamEvent,
                    getCurrentHost: hostOf as any,
                    transactWrite,
                    suppressRelationalFacts: true,
                    relationalEdges: [{ subjectId: STRING_ID, targetId: CUP_ID, operation: 'establish', ...tie }],
                }
            )

            expect(result.ok).toBe(true)
            expect(stepFactCalls(streamEvent)).toEqual([])
        })
    })

    describe('capture step', () => {
        it('a legal commit returns the captured roster keyed by captureId', async () => {
            const roomGraph = withRemainder(ROOM_ID, { tag: 'Character', universalKey: CHARACTER_ID })
            const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
            const otherRoomGraph = withRemainder(otherRoomId)
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [otherRoomId]: otherRoomGraph, [CHARACTER_ID]: moverGraph(CHARACTER_ID, ROOM_ID) })

            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: ROOM_ID, captureId: 'departure' },
                move(CHARACTER_ID, 'p1', ROOM_ID, otherRoomId),
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite, getRoomCharacters: async () => [CHARACTER_ID] }
            )

            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.captures.get('departure')).toEqual([CHARACTER_ID])
        })

        it('a capture naming a host no mutation step touches reads the resolved occupants and locks nothing', async () => {
            const roomGraph = withRemainder(ROOM_ID, { tag: 'Object', universalKey: TRAY_ID })
            const otherRoomId = 'ROOM#Kitchen' as EphemeraRoomId
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })
            const getRoomCharacters = jest.fn(async () => [CHARACTER_ID])

            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: otherRoomId, captureId: 'onlooker' },
                release(TRAY_ID, 'p1', ROOM_ID),
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite, getRoomCharacters }
            )

            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.captures.get('onlooker')).toEqual([CHARACTER_ID])
            expect(getRoomCharacters).toHaveBeenCalledWith(otherRoomId)

            const items = transactWrite.mock.calls[0][0]
            const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item).MultiKeyUpdate
            const keyedHosts = new Set(multiKeyItem.Keys.map((key: any) => key.EphemeraId))
            expect(keyedHosts).toEqual(new Set([TRAY_ID, ROOM_ID]))
        })

        it('an illegal commit discards captures entirely', async () => {
            const roomGraph = withRemainder(ROOM_ID) // stale: tray not actually present
            const characterGraph = withRemainder(CHARACTER_ID)
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })

            const steps: MutationKernelStep[] = [
                { kind: 'capture', hostId: ROOM_ID, captureId: 'departure' },
                move(TRAY_ID, 'p1', ROOM_ID, CHARACTER_ID),
            ]

            const result = await commitStepSequence(
                { steps },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(false)
        })

        it('a forced reducer retry does not duplicate the captured roster', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [] })
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
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite, getRoomCharacters: async () => [CHARACTER_ID] }
            )

            expect(transactWrite).toHaveBeenCalledTimes(2)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.captures.size).toBe(1)
            expect(result.captures.get('before')).toEqual([CHARACTER_ID])
        })
    })

    describe('stale-marking', () => {
        const KITCHEN_ID = 'ROOM#Kitchen' as EphemeraRoomId
        const bumpKeys = (items: any[] | undefined) => (items ?? [])
            .filter((item) => 'PrimitiveUpdate' in item)
            .map((item) => item.PrimitiveUpdate.Key)
        const invalidations = () => streamEvent.mock.calls
            .map(([payload]: any[]) => payload)
            .filter((payload: any) => payload.header.type === 'Ludic Cache Invalidated')
            .map((payload: any) => payload.update.roomIds)

        it('bumps the marker of a moved object\'s two rooms in the same transact call as the graph rows, then publishes the fact once', async () => {
            const graphs = {
                [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
                [KITCHEN_ID]: withRemainder(KITCHEN_ID),
                [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID),
            }
            const { transactWrite, lastItems, cascadeItems } = makeTransactWriteMock(graphs)

            const result = await commitStepSequence(
                { steps: [move(TRAY_ID, 'p1', ROOM_ID, KITCHEN_ID)] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(transactWrite).toHaveBeenCalledTimes(1)
            expect(lastItems.current!.filter((item) => 'MultiKeyUpdate' in item)).toHaveLength(1)
            expect(bumpKeys(cascadeItems.current)).toEqual(expect.arrayContaining([
                { EphemeraId: ROOM_ID, DataCategory: 'LudicCacheVersion::' },
                { EphemeraId: KITCHEN_ID, DataCategory: 'LudicCacheVersion::' },
            ]))
            expect(bumpKeys(cascadeItems.current)).toHaveLength(2)
            expect(cascadeItems.current).toContainEqual({
                PrimitiveUpdate: expect.objectContaining({ UpdateExpression: 'ADD version :one', ExpressionAttributeValues: { ':one': 1 } }),
            })
            expect(invalidations()).toHaveLength(1)
            expect(new Set(invalidations()[0])).toEqual(new Set([ROOM_ID, KITCHEN_ID]))
        })

        it('a character-only move writes no room graph and marks nothing, yet updates the characters rows and both rooms', async () => {
            const graphs = {
                [ROOM_ID]: withRemainder(ROOM_ID),
                [KITCHEN_ID]: withRemainder(KITCHEN_ID),
                [CHARACTER_ID]: moverGraph(CHARACTER_ID, ROOM_ID),
            }
            const { transactWrite, lastItems, cascadeItems } = makeTransactWriteMock(graphs)

            const result = await commitStepSequence(
                { steps: [move(CHARACTER_ID, 'p1', ROOM_ID, KITCHEN_ID)] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            const multiKey = lastItems.current!.find((item) => 'MultiKeyUpdate' in item).MultiKeyUpdate
            expect(multiKey.Keys.map((key: any) => key.EphemeraId)).toEqual([CHARACTER_ID])
            expect(bumpKeys(cascadeItems.current).filter((key: any) => key.DataCategory === 'LudicCacheVersion::')).toEqual([])
            expect(bumpKeys(cascadeItems.current).filter((key: any) => key.DataCategory === 'LudicCache::Characters').map((key: any) => key.EphemeraId).sort())
                .toEqual([KITCHEN_ID, ROOM_ID].sort())
            expect(invalidations()).toEqual([])
            expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: ROOM_ID })
            expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: KITCHEN_ID })
        })

        it('marks the room of a destroyed component, resolved from its pre-commit graph', async () => {
            const graphs = {
                [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
                [TRAY_ID]: testLudicGraph(TRAY_ID, { nodes: [presenceBindingNode('p1', ROOM_ID)] }),
            }
            const { transactWrite, cascadeItems } = makeTransactWriteMock(graphs)

            const result = await commitStepSequence(
                { steps: [release(TRAY_ID, 'p1', ROOM_ID), { kind: 'destroyComponent', hostId: TRAY_ID }] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(bumpKeys(cascadeItems.current)).toEqual([{ EphemeraId: ROOM_ID, DataCategory: 'LudicCacheVersion::' }])
            expect(invalidations()).toEqual([[ROOM_ID]])
        })

        it('marks the room of a relational change', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, { tag: 'Object', universalKey: GLASS_ID }] })
            const { transactWrite, cascadeItems } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })

            await commitStepSequence(
                { steps: [{ kind: 'establishRelation', subjectId: TRAY_ID, targetId: GLASS_ID, hostId: ROOM_ID, relationKind: 'On' }] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(bumpKeys(cascadeItems.current)).toEqual([{ EphemeraId: ROOM_ID, DataCategory: 'LudicCacheVersion::' }])
            expect(invalidations()).toEqual([[ROOM_ID]])
        })

        it('adds no bump and publishes no fact when the sequence writes no room\'s cache (an orphan, a capture)', async () => {
            const orphan = makeTransactWriteMock({ [TRAY_ID]: testLudicGraph(TRAY_ID, { nodes: [presenceBindingNode('born')] }) })
            await commitStepSequence(
                { steps: [{ kind: 'destroyComponent', hostId: TRAY_ID }] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => undefined, transactWrite: orphan.transactWrite }
            )
            expect(bumpKeys(orphan.cascadeItems.current)).toEqual([])

            const capture = makeTransactWriteMock({ [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] }) })
            await commitStepSequence(
                { steps: [{ kind: 'capture', hostId: ROOM_ID, captureId: 'before' }] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite: capture.transactWrite }
            )
            expect(bumpKeys(capture.cascadeItems.current)).toEqual([])
            expect(invalidations()).toEqual([])
        })

        it('bumps nothing and publishes nothing when the transact fails', async () => {
            const roomGraph = withRemainder(ROOM_ID) // stale: tray not actually present
            const { transactWrite, cascadeItems } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: withRemainder(CHARACTER_ID), [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID) })
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

            const result = await commitStepSequence(
                { steps: [move(TRAY_ID, 'p1', ROOM_ID, CHARACTER_ID)] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(false)
            expect(cascadeItems.current).toBeUndefined()
            expect(invalidations()).toEqual([])
            consoleSpy.mockRestore()
        })

        it('retries an SDK-shaped TransactionCanceledException, and publishes the fact once', async () => {
            const graphs = {
                [ROOM_ID]: testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, presenceBindingNode(parentRemainderKey(ROOM_ID))] }),
                [KITCHEN_ID]: withRemainder(KITCHEN_ID),
                [TRAY_ID]: moverGraph(TRAY_ID, ROOM_ID),
            }
            const { transactWrite: inner } = makeTransactWriteMock(graphs)
            let attempt = 0
            const transactWrite: any = jest.fn(async (items: any[]) => {
                await inner(items)
                attempt += 1
                if (attempt === 1) {
                    throw Object.assign(new Error('transaction conflict'), { name: 'TransactionCanceledException' })
                }
            })

            const result = await commitStepSequence(
                { steps: [move(TRAY_ID, 'p1', ROOM_ID, KITCHEN_ID)] },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(true)
            expect(transactWrite).toHaveBeenCalledTimes(2)
            expect(invalidations()).toHaveLength(1)
        })

        it('refuses a transact that would exceed the 100-action limit rather than sending it', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }, { tag: 'Object', universalKey: GLASS_ID }] })
            const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph })
            const existenceItems = Array.from({ length: 100 }, (_, index) => ({ Put: { EphemeraId: `OBJECT#Extra${index}`, DataCategory: 'ASSET#IMPROVISATION' } }))
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

            const result = await commitStepSequence(
                { steps: [{ kind: 'establishRelation', subjectId: TRAY_ID, targetId: GLASS_ID, hostId: ROOM_ID, relationKind: 'On' }], existenceItems },
                { messageBus: messageBus as any, streamEvent, getCurrentHost: () => ROOM_ID, transactWrite }
            )

            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.errorMessage).toMatch(/exceed DynamoDB's limit/)
            consoleSpy.mockRestore()
        })
    })
})
