import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { healLudicGraphPortMismatch } from './healLudicGraphPortMismatch'

const OBJECT_ID = 'OBJECT#Rope' as EphemeraObjectId
const ROOM_ID = 'ROOM#Kitchen' as EphemeraRoomId
const PORT_ID = 'abcd123'

const objectGraph = (ports: { portId: string; fromHostId: string; kind: HostRelationalEdgeKind; exteriorRelationLabel?: string }[]) => ({
    rootId: OBJECT_ID,
    nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
    ports,
})

const roomGraph = (edges: { kind: HostRelationalEdgeKind; relationLabel?: string; portId?: string }[]) => ({
    rootId: ROOM_ID,
    nodes: [
        { tag: 'Room', universalKey: ROOM_ID },
        { tag: 'Object', universalKey: OBJECT_ID },
    ],
    edges: edges.map(({ kind, relationLabel, portId }) => ({
        tag: 'Relational' as const,
        from: ROOM_ID,
        to: { owner: OBJECT_ID, port: portId ?? PORT_ID },
        kind,
        ...(relationLabel === undefined ? {} : { relationLabel }),
    })),
    ports: [],
})

const readerFor = (graphs: Record<string, unknown>) => async (ephemeraId: string) => graphs[ephemeraId]

describe('healLudicGraphPortMismatch', () => {
    it('reports stale: false and writes nothing when the port agrees with its named referrer (idempotent)', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'On' }]),
                [ROOM_ID]: roomGraph([{ kind: 'On' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('dry-run reports the exact repair without writing', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: true }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }]),
                [ROOM_ID]: roomGraph([{ kind: 'On' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({
            stale: true,
            healable: true,
            applied: false,
            repairedPayload: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'On' }]),
        })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('commit mode writes the repaired payload, correcting toward the exterior edge', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'threads into' }]),
                [ROOM_ID]: roomGraph([{ kind: 'Custom', relationLabel: 'is lashed to' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({ stale: true, healable: true, applied: true })
        expect(writeHealedLudicGraph).toHaveBeenCalledWith(
            OBJECT_ID,
            objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'is lashed to' }])
        )
    })

    it('drops a stale label when the exterior edge carries none', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'On', exteriorRelationLabel: 'leftover' }]),
                [ROOM_ID]: roomGraph([{ kind: 'On' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            healable: true,
            repairedPayload: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'On' }]),
        })
    })

    it('repairs only the named port, leaving its siblings untouched', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const sibling = { portId: 'zzz999', fromHostId: ROOM_ID, kind: 'Present' as const }
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }, sibling]),
                // The sibling disagrees with its own referring edge too, and is still not touched:
                // this heal repairs the port the finding named, not everything it happens to see.
                [ROOM_ID]: roomGraph([{ kind: 'On' }, { kind: 'Under', portId: 'zzz999' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toMatchObject({
            healable: true,
            repairedPayload: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'On' }, sibling]),
        })
    })

    it('reports healable: false without writing when the exterior fan disagrees with itself', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }]),
                [ROOM_ID]: roomGraph([{ kind: 'On' }, { kind: 'Under' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: true, healable: false, applied: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('writes nothing when the named referrer holds no edge into this port (gated: reverse-index work)', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }]),
                [ROOM_ID]: roomGraph([]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('writes nothing when the referrer graph is absent', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('writes nothing when the interior row itself fails the shape guard (the structure heal owns that)', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: { rootId: OBJECT_ID, nodes: [] },
                [ROOM_ID]: roomGraph([{ kind: 'On' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('writes nothing when the named port is no longer on the row (redelivery after another repair)', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const outcome = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, {
            getStoredLudicGraph: readerFor({
                [OBJECT_ID]: objectGraph([]),
                [ROOM_ID]: roomGraph([{ kind: 'On' }]),
            }),
            writeHealedLudicGraph,
        })
        expect(outcome).toEqual({ stale: false })
        expect(writeHealedLudicGraph).not.toHaveBeenCalled()
    })

    it('is a no-op on redelivery once the repair has landed (at-least-once safety)', async () => {
        const writeHealedLudicGraph = jest.fn(async () => undefined)
        const graphs: Record<string, unknown> = {
            [OBJECT_ID]: objectGraph([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }]),
            [ROOM_ID]: roomGraph([{ kind: 'On' }]),
        }
        const deps = {
            getStoredLudicGraph: async (ephemeraId: string) => graphs[ephemeraId],
            writeHealedLudicGraph: async (ephemeraId: string, payload: unknown) => {
                graphs[ephemeraId] = payload
                await writeHealedLudicGraph()
            },
        }
        const first = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, deps as any)
        const second = await healLudicGraphPortMismatch(OBJECT_ID, PORT_ID, { dryRun: false }, deps as any)

        expect(first).toMatchObject({ stale: true, healable: true, applied: true })
        expect(second).toEqual({ stale: false })
        expect(writeHealedLudicGraph).toHaveBeenCalledTimes(1)
    })
})
