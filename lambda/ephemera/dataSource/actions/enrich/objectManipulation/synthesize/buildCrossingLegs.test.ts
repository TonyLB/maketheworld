import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { buildCrossingLegs, buildCrossingDissolveLegs } from './buildCrossingLegs'
import type { RelationalChainStep } from './findRelationalChain'

const ROOM_ID = 'ROOM#Vortex' as EphemeraRoomId
const STRING_ID = 'OBJECT#String' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const BOX_ID = 'OBJECT#Box' as EphemeraObjectId
const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId

describe('buildCrossingLegs', () => {
    it("PV1-0's own readout case: rope in room, cup on table -- exactly two legs and one crossing port, on the interior (table) side", () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [TABLE_ID, ROOM_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('built')
        if (result.verdict !== 'built') return
        expect(result.steps).toHaveLength(3)

        const [addPortStep, tableLegStep, roomLegStep] = result.steps
        expect(addPortStep).toMatchObject({
            kind: 'addCrossingPort',
            hostId: TABLE_ID,
            port: { fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' },
        })
        if (addPortStep.kind !== 'addCrossingPort') return
        const portId = addPortStep.port.portId
        expect(typeof portId).toBe('string')

        expect(tableLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: { owner: TABLE_ID, port: portId },
            targetId: CUP_ID,
            hostId: TABLE_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
        expect(roomLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: STRING_ID,
            targetId: { owner: TABLE_ID, port: portId },
            hostId: ROOM_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
    })

    it('symmetric case: subject has the extra hop instead of target (string in a box, cup direct in room)', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [BOX_ID, ROOM_ID],
            targetPath: [ROOM_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('built')
        if (result.verdict !== 'built') return
        expect(result.steps).toHaveLength(3)

        const [addPortStep, boxLegStep, roomLegStep] = result.steps
        expect(addPortStep).toMatchObject({ kind: 'addCrossingPort', hostId: BOX_ID, port: { fromHostId: ROOM_ID } })
        if (addPortStep.kind !== 'addCrossingPort') return
        const portId = addPortStep.port.portId

        expect(boxLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: STRING_ID,
            targetId: { owner: BOX_ID, port: portId },
            hostId: BOX_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
        expect(roomLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: { owner: BOX_ID, port: portId },
            targetId: CUP_ID,
            hostId: ROOM_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
    })

    it('degenerate same-shard case (both paths length 1): a single leg, no port minted', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [ROOM_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result).toEqual({
            verdict: 'built',
            steps: [
                { kind: 'establishRelation', subjectId: STRING_ID, targetId: CUP_ID, hostId: ROOM_ID, relationKind: 'Custom', relationLabel: 'to' },
            ],
        })
    })

    it('PV1-3b-4: a degenerate same-shard dissolve produces a dissolveRelation step, not establishRelation', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [ROOM_ID],
            relationKind: 'Custom',
            relationLabel: 'to',
            operationKind: 'dissolveRelation',
        })

        expect(result).toEqual({
            verdict: 'built',
            steps: [
                { kind: 'dissolveRelation', subjectId: STRING_ID, targetId: CUP_ID, hostId: ROOM_ID, relationKind: 'Custom', relationLabel: 'to' },
            ],
        })
    })

    it('PV1-3b-4: reports notYetImplemented for a dissolve that crosses a real boundary --- removing a minted port is unbuilt', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [TABLE_ID, ROOM_ID],
            relationKind: 'Custom',
            relationLabel: 'to',
            operationKind: 'dissolveRelation',
        })

        expect(result.verdict).toBe('notYetImplemented')
    })

    it('zero-length target path (the target IS the common ancestor): a single leg in that host, no port minted', () => {
        const result = buildCrossingLegs({
            subjectId: CUP_ID,
            targetId: TABLE_ID,
            commonAncestor: TABLE_ID,
            subjectPath: [TABLE_ID],
            targetPath: [],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result).toEqual({
            verdict: 'built',
            steps: [
                { kind: 'establishRelation', subjectId: CUP_ID, targetId: TABLE_ID, hostId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
            ],
        })
    })

    it('zero-length subject path: the same single leg with the hosting endpoint as subject', () => {
        const result = buildCrossingLegs({
            subjectId: TABLE_ID,
            targetId: CUP_ID,
            commonAncestor: TABLE_ID,
            subjectPath: [],
            targetPath: [TABLE_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result).toEqual({
            verdict: 'built',
            steps: [
                { kind: 'establishRelation', subjectId: TABLE_ID, targetId: CUP_ID, hostId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
            ],
        })
    })

    it('zero-length subject path against a one-extra-hop target: one port on the interior side, two legs', () => {
        const result = buildCrossingLegs({
            subjectId: TABLE_ID,
            targetId: CUP_ID,
            commonAncestor: TABLE_ID,
            subjectPath: [],
            targetPath: [BOX_ID, TABLE_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('built')
        if (result.verdict !== 'built') return
        expect(result.steps).toHaveLength(3)

        const [addPortStep, boxLegStep, tableLegStep] = result.steps
        expect(addPortStep).toMatchObject({
            kind: 'addCrossingPort',
            hostId: BOX_ID,
            port: { fromHostId: TABLE_ID, kind: 'Custom', exteriorRelationLabel: 'to' },
        })
        if (addPortStep.kind !== 'addCrossingPort') return
        const portId = addPortStep.port.portId

        expect(boxLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: { owner: BOX_ID, port: portId },
            targetId: CUP_ID,
            hostId: BOX_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
        // The final leg lives in the common ancestor's own graph, running from its root node (the
        // table itself) to the port --- the zero-length side contributes the raw endpoint, not a
        // port address, which is what keeps this out of the unsupported port-to-port middle-leg case.
        expect(tableLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: TABLE_ID,
            targetId: { owner: BOX_ID, port: portId },
            hostId: TABLE_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
    })

    it('a non-Custom relation kind carries no relationLabel on the port or the legs', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [TABLE_ID, ROOM_ID],
            operationKind: 'establishRelation',
            relationKind: 'Under',
        })

        expect(result.verdict).toBe('built')
        if (result.verdict !== 'built') return
        const [addPortStep] = result.steps
        expect(addPortStep).toMatchObject({ kind: 'addCrossingPort', port: { kind: 'Under' } })
        if (addPortStep.kind !== 'addCrossingPort') return
        expect(addPortStep.port).not.toHaveProperty('exteriorRelationLabel')
    })

    it('reports notYetImplemented when both sides have an extra hop (a middle port-to-port leg would be needed)', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [BOX_ID, ROOM_ID],
            targetPath: [TABLE_ID, ROOM_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('notYetImplemented')
    })

    it('reports notYetImplemented for a path longer than one extra hop', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [BOX_ID, TABLE_ID, ROOM_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('notYetImplemented')
    })
})

describe('buildCrossingDissolveLegs', () => {
    it("PV1-0's own readout case, reversed: a 3-step found chain (edge, port, edge) becomes [dissolveRelation, removeCrossingPort, dissolveRelation]", () => {
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const steps: RelationalChainStep[] = [
            { type: 'edge', hostId: ROOM_ID, edge: { from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom', relationLabel: 'to' } },
            { type: 'port', hostId: TABLE_ID, port },
            { type: 'edge', hostId: TABLE_ID, edge: { from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom', relationLabel: 'to' } },
        ]

        expect(buildCrossingDissolveLegs(steps)).toEqual([
            {
                kind: 'dissolveRelation',
                subjectId: STRING_ID,
                targetId: { owner: TABLE_ID, port: 'port-1' },
                hostId: ROOM_ID,
                relationKind: 'Custom',
                relationLabel: 'to',
            },
            { kind: 'removeCrossingPort', hostId: TABLE_ID, portId: 'port-1' },
            {
                kind: 'dissolveRelation',
                subjectId: { owner: TABLE_ID, port: 'port-1' },
                targetId: CUP_ID,
                hostId: TABLE_ID,
                relationKind: 'Custom',
                relationLabel: 'to',
            },
        ])
    })

    it('a portless same-host chain becomes a single dissolveRelation step, nothing else', () => {
        const steps: RelationalChainStep[] = [
            { type: 'edge', hostId: ROOM_ID, edge: { from: STRING_ID, to: CUP_ID, kind: 'Custom', relationLabel: 'to' } },
        ]

        expect(buildCrossingDissolveLegs(steps)).toEqual([
            { kind: 'dissolveRelation', subjectId: STRING_ID, targetId: CUP_ID, hostId: ROOM_ID, relationKind: 'Custom', relationLabel: 'to' },
        ])
    })

    it('a non-Custom relation kind carries no relationLabel on the emitted step', () => {
        const steps: RelationalChainStep[] = [
            { type: 'edge', hostId: ROOM_ID, edge: { from: STRING_ID, to: CUP_ID, kind: 'Under' } },
        ]

        const [dissolveStep] = buildCrossingDissolveLegs(steps)
        expect(dissolveStep).toEqual({ kind: 'dissolveRelation', subjectId: STRING_ID, targetId: CUP_ID, hostId: ROOM_ID, relationKind: 'Under' })
        expect(dissolveStep).not.toHaveProperty('relationLabel')
    })

    it('a two-hop chain on one side --- deeper than buildCrossingLegs itself can mint --- maps through with no cap and no notYetImplemented case', () => {
        const portA: EphemeraCrossingPort = { portId: 'port-a', fromHostId: ROOM_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const portB: EphemeraCrossingPort = { portId: 'port-b', fromHostId: BOX_ID, kind: 'Custom', exteriorRelationLabel: 'to' }
        const steps: RelationalChainStep[] = [
            { type: 'edge', hostId: ROOM_ID, edge: { from: STRING_ID, to: { owner: BOX_ID, port: 'port-a' }, kind: 'Custom', relationLabel: 'to' } },
            { type: 'port', hostId: BOX_ID, port: portA },
            { type: 'edge', hostId: BOX_ID, edge: { from: { owner: BOX_ID, port: 'port-a' }, to: { owner: TRAY_ID, port: 'port-b' }, kind: 'Custom', relationLabel: 'to' } },
            { type: 'port', hostId: TRAY_ID, port: portB },
            { type: 'edge', hostId: TRAY_ID, edge: { from: { owner: TRAY_ID, port: 'port-b' }, to: CUP_ID, kind: 'Custom', relationLabel: 'to' } },
        ]

        const result = buildCrossingDissolveLegs(steps)

        expect(result).toHaveLength(5)
        expect(result.map((step) => step.kind)).toEqual([
            'dissolveRelation',
            'removeCrossingPort',
            'dissolveRelation',
            'removeCrossingPort',
            'dissolveRelation',
        ])
        expect(result[1]).toEqual({ kind: 'removeCrossingPort', hostId: BOX_ID, portId: 'port-a' })
        expect(result[3]).toEqual({ kind: 'removeCrossingPort', hostId: TRAY_ID, portId: 'port-b' })
    })
})
