import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import { produce } from 'immer'

import { applyHostRelationalPatch } from './applyHostRelationalPatch'
import type { HostRelationalPatch } from './types'

const BROOM_ID = 'OBJECT#Broom' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const roomGraphWithObjects = {
    nodes: [
        { tag: 'Object' as const, universalKey: BROOM_ID },
        { tag: 'Object' as const, universalKey: TABLE_ID },
    ],
} as unknown as PlayPositionGraph

const onTablePatch: HostRelationalPatch = {
    hostId: ROOM_ID,
    edge: { from: BROOM_ID, to: TABLE_ID, kind: 'On' },
    op: 'add',
}

describe('applyHostRelationalPatch', () => {
    const transactWrite = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips transact when patches is empty', async () => {
        const result = await applyHostRelationalPatch({ patches: [] }, { transactWrite })

        expect(result).toEqual({ ok: true, persisted: false, changed: false })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('persists add patch in one transact', async () => {
        const result = await applyHostRelationalPatch(
            { patches: [onTablePatch] },
            {
                getPositionGraph: async () => roomGraphWithObjects,
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: true,
            persisted: true,
            changed: true,
        })
        expect(transactWrite).toHaveBeenCalledTimes(1)
        const items = transactWrite.mock.calls[0][0] as any[]
        expect(items).toHaveLength(1)

        const roomGraphDraft = produce({ positionGraph: { ...roomGraphWithObjects, edges: [] } }, (draft) => {
            items[0].Update.updateReducer(draft)
        })
        expect(roomGraphDraft.positionGraph?.edges).toEqual([{
            tag: 'Relational',
            from: BROOM_ID,
            to: TABLE_ID,
            kind: 'On',
        }])
    })

    it('returns idempotent no-op when exact edge already present on add', async () => {
        const result = await applyHostRelationalPatch(
            { patches: [onTablePatch] },
            {
                getPositionGraph: async () => ({
                    ...roomGraphWithObjects,
                    edges: [{
                        tag: 'Relational' as const,
                        from: BROOM_ID,
                        to: TABLE_ID,
                        kind: 'On' as const,
                    }],
                } as unknown as PlayPositionGraph),
                transactWrite,
            }
        )

        expect(result).toEqual({ ok: true, persisted: false, changed: false })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('persists remove patch when edge is present', async () => {
        const result = await applyHostRelationalPatch(
            { patches: [{ ...onTablePatch, op: 'remove' }] },
            {
                getPositionGraph: async () => ({
                    ...roomGraphWithObjects,
                    edges: [{
                        tag: 'Relational' as const,
                        from: BROOM_ID,
                        to: TABLE_ID,
                        kind: 'On' as const,
                    }],
                } as unknown as PlayPositionGraph),
                transactWrite,
            }
        )

        expect(result).toMatchObject({ ok: true, persisted: true, changed: true })
        const items = transactWrite.mock.calls[0][0] as any[]
        const roomGraphDraft = produce({
            positionGraph: {
                ...roomGraphWithObjects,
                edges: [{
                    tag: 'Relational' as const,
                    from: BROOM_ID,
                    to: TABLE_ID,
                    kind: 'On' as const,
                }],
            },
        }, (draft) => {
            items[0].Update.updateReducer(draft)
        })
        expect(roomGraphDraft.positionGraph?.edges).toEqual([])
    })

    it('rejects remove when edge is absent', async () => {
        const result = await applyHostRelationalPatch(
            { patches: [{ ...onTablePatch, op: 'remove' }] },
            {
                getPositionGraph: async () => roomGraphWithObjects,
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('rejects add when nodes are missing from host graph', async () => {
        const result = await applyHostRelationalPatch(
            { patches: [onTablePatch] },
            {
                getPositionGraph: async () => ({ nodes: [{ tag: 'Object' as const, universalKey: BROOM_ID }] } as unknown as PlayPositionGraph),
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_VALIDATION_FAILED',
        })
        expect(transactWrite).not.toHaveBeenCalled()
    })

    it('returns transact failure when transactWrite throws', async () => {
        transactWrite.mockRejectedValueOnce(new Error('conditional failed'))

        const result = await applyHostRelationalPatch(
            { patches: [onTablePatch] },
            {
                getPositionGraph: async () => roomGraphWithObjects,
                transactWrite,
            }
        )

        expect(result).toMatchObject({
            ok: false,
            errorCode: 'HOST_RELATIONAL_PATCH_TRANSACT_FAILED',
            errorMessage: 'conditional failed',
        })
    })
})
