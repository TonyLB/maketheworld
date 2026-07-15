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
 * draft `Record` from `graphsByHost` (structurally, matching `applyObjectSetTransfer`'s own
 * lookup-by-EphemeraId/DataCategory convention, since the real library keys by a private
 * marshalled-key string this code deliberately avoids depending on) and invokes the reducer.
 * `transactWrite`'s own internal fetch is the *only* fetch `applyObjectSetTransfer` performs
 * (2026-07-15 redesign) --- `graphsByHost` stands in for whatever is actually in the database
 * at the moment of commit.
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
        const { transactWrite, lastDraft } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [TRAY_ID, GLASS_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, transactWrite }
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
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [TRAY_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result).toMatchObject({
            ok: true,
            diffs: [{ objectId: TRAY_ID, froms: [ROOM_ID], to: CHARACTER_ID, changed: true }],
        })
        expect(transactWrite).toHaveBeenCalledTimes(1)
    })

    it('skips the kernel call entirely when the object set is empty', async () => {
        const transactWrite = jest.fn()

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result).toEqual({ ok: true, diffs: [] })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('rejects a stale transfer candidate invalidated by a concurrent modification, discovered live at commit time', async () => {
        // A concurrent command has added `book On tray` since the candidate was selected --- book
        // is not in the transfer set, so this boundary edge now classifies `carry` (BD-13's own
        // outcome for a target-moves `On` edge): the given transfer set is stale/incomplete. There
        // is only one fetch now (the reducer's own), so this is the only graph state that matters.
        const roomGraph = testPositionGraph(ROOM_ID, {
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
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

        const result = await applyObjectSetTransfer(
            { direction: 'takeHold', objectIds: [TRAY_ID, GLASS_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errorCode).toBe('OBJECT_SET_TRANSFER_TRANSACT_FAILED')
        expect(transactWrite).toHaveBeenCalledTimes(1)
        expect(streamEvent).not.toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).not.toHaveBeenCalled()
    })

    it('rejects a stale candidate via the presence guard --- transactWrite is still attempted, not skipped', async () => {
        const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TABLE_ID }], edges: [] })
        const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })
        const { transactWrite } = makeTransactWriteMock({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

        const result = await applyObjectSetTransfer(
            // TRAY_ID isn't actually on the room graph --- a stale candidate.
            { direction: 'takeHold', objectIds: [TRAY_ID], roomId: ROOM_ID, characterId: CHARACTER_ID },
            { messageBus: messageBus as any, streamEvent, transactWrite }
        )

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errorCode).toBe('OBJECT_SET_TRANSFER_TRANSACT_FAILED')
        expect(transactWrite).toHaveBeenCalledTimes(1)
    })
})
