import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectSetTransfer } from './applyObjectSetTransfer'
import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getPositionGraph: jest.fn(),
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
const BOOK_ID = 'OBJECT#Book' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Simulates `transactWrite`'s `MultiKeyUpdate` handling for unit-testing purposes: builds a
 * draft `Record` from `freshGraphsByHost` (structurally, matching `applyObjectSetTransfer`'s
 * own lookup-by-EphemeraId/DataCategory convention, since the real library keys by a private
 * marshalled-key string this code deliberately avoids depending on) and invokes the reducer.
 * `freshGraphsByHost` may deliberately differ from the pre-check fetch --- that's how the
 * race-condition test below exercises commit-time re-validation.
 */
const makeTransactWriteMock = (freshGraphsByHost: Record<string, EphemeraPositionGraph>) => {
    const lastDraft: { current: Record<string, any> | undefined } = { current: undefined }
    const transactWrite: any = jest.fn(async (items: any[]): Promise<void> => {
        const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        if (!multiKeyItem) {
            return
        }
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
            const graph = freshGraphsByHost[key.EphemeraId]
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

describe('applyObjectSetTransfer', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("BD-13 worked example: moves [tray, glass] atomically, dissolving tray-table and carrying glass-tray", async () => {
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
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })

        const getPositionGraph = async (hostId: string): Promise<EphemeraPositionGraph> =>
            hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
        const { transactWrite, lastDraft } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [TRAY_ID, GLASS_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getPositionGraph, transactWrite }
        )

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.diffs).toEqual(
            expect.arrayContaining([
                { objectId: TRAY_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true },
                { objectId: GLASS_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true },
            ])
        )
        expect(transactWrite).toHaveBeenCalledTimes(1)

        const draft = lastDraft.current
        expect(draft).toBeDefined()
        expect(draft![`${ROOM_ID}#Meta::Room`].positionGraph).toEqual({
            nodes: [{ tag: 'Object', universalKey: TABLE_ID }],
            edges: [],
        })
        expect(draft![`${CHARACTER_ID}#Meta::Character`].positionGraph).toEqual({
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: GLASS_ID },
            ],
            edges: [{ tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' }],
        })

        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Moved', objectId: TRAY_ID }),
        }))
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Moved', objectId: GLASS_ID }),
        }))

        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: TRAY_ID,
            containers: [CHARACTER_ID],
        })
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: GLASS_ID,
            containers: [CHARACTER_ID],
        })
    })

    it('degenerates to single-object behavior when the set has one member', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })
        const getPositionGraph = async (hostId: string): Promise<EphemeraPositionGraph> =>
            hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [TRAY_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getPositionGraph, transactWrite }
        )

        expect(result).toMatchObject({
            ok: true,
            diffs: [{ objectId: TRAY_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true }],
        })
        expect(transactWrite).toHaveBeenCalledTimes(1)
    })

    it('skips the kernel call entirely when the object set is empty', async () => {
        const getPositionGraph = jest.fn()
        const transactWrite = jest.fn()

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getPositionGraph, transactWrite }
        )

        expect(result).toEqual({ ok: true, diffs: [] })
        expect(getPositionGraph).not.toHaveBeenCalled()
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('rejects a stale transfer candidate that a concurrent modification invalidated between selection and commit', async () => {
        // Pre-check fetch: only the intended carry (glass On tray) is present, so the candidate
        // looks legal at selection time.
        const precheckRoomGraph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: GLASS_ID },
            ],
            edges: [{ tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' }],
        })
        // Fresh fetch (as seen by the MultiKeyUpdate reducer at commit time): a concurrent
        // command has added `book On tray` --- book is not in the transfer set, so this boundary
        // edge now classifies `carry` (BD-13's own outcome for a target-moves `On` edge), meaning
        // the transfer set computed at selection time is stale/incomplete.
        const freshRoomGraph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object', universalKey: TRAY_ID },
                { tag: 'Object', universalKey: GLASS_ID },
                { tag: 'Object', universalKey: BOOK_ID },
            ],
            edges: [
                { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
                { tag: 'Relational', from: BOOK_ID, to: TRAY_ID, kind: 'On' },
            ],
        })
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })

        const getPositionGraph = async (hostId: string): Promise<EphemeraPositionGraph> =>
            hostId === ROOM_ID ? precheckRoomGraph : emptyCharacterGraph
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: freshRoomGraph, [CHARACTER_ID]: emptyCharacterGraph })

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [TRAY_ID, GLASS_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getPositionGraph, transactWrite }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errorCode).toBe('OBJECT_SET_TRANSFER_TRANSACT_FAILED')
        expect(streamEvent).not.toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).not.toHaveBeenCalled()
    })

    it('rejects a candidate that already looks stale at the pre-check fetch (fast-fail, no transactWrite attempt)', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }], edges: [] })
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })
        const getPositionGraph = async (hostId: string): Promise<EphemeraPositionGraph> =>
            hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
        const transactWrite = jest.fn()

        const result = await applyObjectSetTransfer(
            // TRAY_ID isn't actually on the room graph --- a stale candidate.
            { direction: 'takeHold', objectIds: [TRAY_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, getPositionGraph, transactWrite }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errorCode).toBe('OBJECT_SET_TRANSFER_VALIDATION_FAILED')
        expect(transactWrite).not.toHaveBeenCalled()
    })
})
