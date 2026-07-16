import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testPositionGraph } from '../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../positionGraph'
import { applyHostRelationalPatch } from './applyHostRelationalPatch'
import type { HostRelationalPatch } from './types'

const BROOM_ID = 'OBJECT#Broom' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHARM_ID = 'OBJECT#Charm' as EphemeraObjectId
const NECKLACE_ID = 'OBJECT#Necklace' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Simulates `transactWrite`'s `MultiKeyUpdate` handling, mirroring
 * `applyObjectSetTransfer.test.ts`'s convention: `transactWrite`'s own internal
 * fetch is the *only* fetch `applyHostRelationalPatch` performs (2026-07-15
 * redesign), so `graphsByHost` stands in for whatever is actually in the
 * database at the moment of commit --- an inert no-op mock would silently pass
 * tests that the live reducer would actually reject.
 */
const makeTransactWriteMock = (graphsByHost: Record<string, EphemeraPositionGraph>) => {
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
    })
    return transactWrite
}

const roomGraphWithObjects = testPositionGraph(ROOM_ID, {
    nodes: [
        { tag: 'Object' as const, universalKey: BROOM_ID },
        { tag: 'Object' as const, universalKey: TABLE_ID },
    ],
})

const onTablePatch: HostRelationalPatch = {
    hostId: ROOM_ID,
    edge: { from: BROOM_ID, to: TABLE_ID, kind: 'On' },
    op: 'add',
}

describe('applyHostRelationalPatch', () => {
    it('skips transact when patches is empty', async () => {
        const transactWrite = makeTransactWriteMock({})
        const result = await applyHostRelationalPatch({ patches: [] }, { transactWrite })

        expect(result).toEqual({ ok: true, persisted: false, changed: false })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('persists add patch in one transact', async () => {
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: roomGraphWithObjects })

        const result = await applyHostRelationalPatch({ patches: [onTablePatch] }, { transactWrite })

        expect(result).toMatchObject({ ok: true, persisted: true, changed: true })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        if (result.ok && result.persisted) {
            expect(result.postApplyGraphs[0].relationalEdges).toEqual([{ from: BROOM_ID, to: TABLE_ID, kind: 'On' }])
        }
    })

    it('persists an add patch on a Character host (new capability, BD-15/16)', async () => {
        const characterGraph = testPositionGraph(CHARACTER_ID, {
            nodes: [
                { tag: 'Object' as const, universalKey: CHARM_ID },
                { tag: 'Object' as const, universalKey: NECKLACE_ID },
            ],
        })
        const transactWrite = makeTransactWriteMock({ [CHARACTER_ID]: characterGraph })

        const result = await applyHostRelationalPatch(
            { patches: [{ hostId: CHARACTER_ID, edge: { from: CHARM_ID, to: NECKLACE_ID, kind: 'On' }, op: 'add' }] },
            { transactWrite }
        )

        expect(result).toMatchObject({ ok: true, persisted: true, changed: true })
    })

    it('returns idempotent no-op when exact edge already present on add', async () => {
        const graph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object' as const, universalKey: BROOM_ID },
                { tag: 'Object' as const, universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational' as const, from: BROOM_ID, to: TABLE_ID, kind: 'On' as const }],
        })
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: graph })

        const result = await applyHostRelationalPatch({ patches: [onTablePatch] }, { transactWrite })

        expect(result).toEqual({ ok: true, persisted: false, changed: false })
    })

    it('persists remove patch when edge is present', async () => {
        const graph = testPositionGraph(ROOM_ID, {
            nodes: [
                { tag: 'Object' as const, universalKey: BROOM_ID },
                { tag: 'Object' as const, universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational' as const, from: BROOM_ID, to: TABLE_ID, kind: 'On' as const }],
        })
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: graph })

        const result = await applyHostRelationalPatch(
            { patches: [{ ...onTablePatch, op: 'remove' }] },
            { transactWrite }
        )

        expect(result).toMatchObject({ ok: true, persisted: true, changed: true })
        if (result.ok && result.persisted) {
            expect(result.postApplyGraphs[0].relationalEdges).toEqual([])
        }
    })

    it('rejects remove when edge is absent', async () => {
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: roomGraphWithObjects })

        const result = await applyHostRelationalPatch(
            { patches: [{ ...onTablePatch, op: 'remove' }] },
            { transactWrite }
        )

        expect(result).toMatchObject({ ok: false, errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED' })
    })

    it('rejects add when nodes are missing from host graph', async () => {
        const graph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object' as const, universalKey: BROOM_ID }] })
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: graph })

        const result = await applyHostRelationalPatch({ patches: [onTablePatch] }, { transactWrite })

        expect(result).toMatchObject({ ok: false, errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED' })
    })

    it('rejects a patch whose sameHost precondition went stale between selection and commit', async () => {
        // Fresh state at commit time: TABLE_ID is no longer present on the room graph
        // (a concurrent write removed it) --- bothObjectsOnGraph now fails live, even
        // though an earlier, separately-fetched check might have passed.
        const staleGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object' as const, universalKey: BROOM_ID }] })
        const transactWrite = makeTransactWriteMock({ [ROOM_ID]: staleGraph })

        const result = await applyHostRelationalPatch({ patches: [onTablePatch] }, { transactWrite })

        expect(result).toMatchObject({ ok: false, errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED' })
    })

    it('returns transact failure when transactWrite throws', async () => {
        const transactWrite = jest.fn().mockRejectedValue(new Error('conditional failed'))

        const result = await applyHostRelationalPatch({ patches: [onTablePatch] }, { transactWrite })

        expect(result).toMatchObject({
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED',
            errorMessage: 'conditional failed',
        })
    })
})
