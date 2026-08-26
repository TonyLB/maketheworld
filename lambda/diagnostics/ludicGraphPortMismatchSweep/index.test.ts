import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind, RelationalEdgeKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ludicGraphPortMismatchSweep } from './index'

const ROOM_ID = 'ROOM#Kitchen' as EphemeraRoomId
const OBJECT_ID = 'OBJECT#Rope' as EphemeraObjectId
const PORT_ID = 'abcd123'

const objectRow = (ports: { portId: string; fromHostId: string; kind: HostRelationalEdgeKind; exteriorRelationLabel?: string }[]) => ({
    EphemeraId: OBJECT_ID,
    DataCategory: 'Meta::Object',
    ludicGraph: {
        rootId: OBJECT_ID,
        nodes: [{ tag: 'Object', universalKey: OBJECT_ID }],
        ports,
    },
})

const roomRow = (edges: (RelationalEdgeKindAndLabel & { portId?: string })[]) => ({
    EphemeraId: ROOM_ID,
    DataCategory: 'Meta::Room',
    ludicGraph: {
        rootId: ROOM_ID,
        nodes: [
            { tag: 'Room', universalKey: ROOM_ID },
            { tag: 'Object', universalKey: OBJECT_ID },
        ],
        edges: edges.map((edge) => ({
            tag: 'Relational' as const,
            from: ROOM_ID,
            to: { owner: OBJECT_ID, port: edge.portId ?? PORT_ID },
            ...(edge.kind === 'Custom'
                ? { kind: 'Custom' as const, relationLabel: edge.relationLabel }
                : { kind: edge.kind }),
        })),
        ports: [],
    },
})

describe('ludicGraphPortMismatchSweep', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits nothing over a corpus with no ports at all --- the provable state before a producer exists', async () => {
        const result = await ludicGraphPortMismatchSweep(
            {},
            {
                listCandidateRows: async () => [objectRow([]), roomRow([])],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ports: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('emits one finding naming the port when its kind disagrees with the named referrer', async () => {
        const result = await ludicGraphPortMismatchSweep(
            { diagnosticRunId: 'run-lgpm', nowMs: 1_700_000_000_000 },
            {
                listCandidateRows: async () => [
                    objectRow([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }]),
                    roomRow([{ kind: 'On' }]),
                ],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 1, ports: [{ ephemeraId: OBJECT_ID, portId: PORT_ID }] })
        expect(emitFinding).toHaveBeenCalledWith({
            ephemeraId: OBJECT_ID,
            portId: PORT_ID,
            diagnosticRunId: 'run-lgpm',
            nowMs: 1_700_000_000_000,
            eventBusName: 'test-bus',
        })
    })

    it('emits nothing when the port and the referring edge agree', async () => {
        const result = await ludicGraphPortMismatchSweep(
            {},
            {
                listCandidateRows: async () => [
                    objectRow([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'threads into' }]),
                    roomRow([{ kind: 'Custom', relationLabel: 'threads into' }]),
                ],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ports: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('emits nothing when the named referrer is not in the corpus at all (gated: no reverse index)', async () => {
        const result = await ludicGraphPortMismatchSweep(
            {},
            {
                listCandidateRows: async () => [objectRow([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }])],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ports: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('skips a row whose own graph fails the shape guard, leaving it to the structure sweep', async () => {
        const result = await ludicGraphPortMismatchSweep(
            {},
            {
                listCandidateRows: async () => [
                    { EphemeraId: OBJECT_ID, DataCategory: 'Meta::Object', ludicGraph: { rootId: OBJECT_ID, nodes: [] } },
                    roomRow([{ kind: 'On' }]),
                ],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ports: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('ignores a row whose EphemeraId is not a legal membership host id', async () => {
        const result = await ludicGraphPortMismatchSweep(
            {},
            {
                listCandidateRows: async () => [
                    { ...objectRow([{ portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' }]), EphemeraId: 'BOGUS#not-a-host' },
                    roomRow([{ kind: 'On' }]),
                ],
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, ports: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('emits one finding per mismatching port, sorted by host then port', async () => {
        const result = await ludicGraphPortMismatchSweep(
            { diagnosticRunId: 'run-multi', nowMs: 1000 },
            {
                listCandidateRows: async () => [
                    objectRow([
                        { portId: 'zzz999', fromHostId: ROOM_ID, kind: 'Present' },
                        { portId: PORT_ID, fromHostId: ROOM_ID, kind: 'Present' },
                    ]),
                    roomRow([{ kind: 'On' }, { kind: 'Under', portId: 'zzz999' }]),
                ],
                emitFinding,
            }
        )

        expect(result.emittedCount).toBe(2)
        expect(result.ports).toEqual([
            { ephemeraId: OBJECT_ID, portId: PORT_ID },
            { ephemeraId: OBJECT_ID, portId: 'zzz999' },
        ])
        expect(emitFinding).toHaveBeenCalledTimes(2)
    })

    it('throws without EVENT_BUS_NAME', async () => {
        delete process.env.EVENT_BUS_NAME
        await expect(ludicGraphPortMismatchSweep({}, { listCandidateRows: async () => [], emitFinding }))
            .rejects.toThrow('EVENT_BUS_NAME')
    })
})
