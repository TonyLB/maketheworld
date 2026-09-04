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

// A branching tree for PV1-6's "both sides at once"/general-depth cases: A contains B; B
// contains C and E; C contains D (and, in the deeper variant, D2 contains D); E contains F.
const B_ID = 'OBJECT#B' as EphemeraObjectId
const C_ID = 'OBJECT#C' as EphemeraObjectId
const D_ID = 'OBJECT#D' as EphemeraObjectId
const D2_ID = 'OBJECT#D2' as EphemeraObjectId
const E_ID = 'OBJECT#E' as EphemeraObjectId
const F_ID = 'OBJECT#F' as EphemeraObjectId

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

    it("PV1-6: both sides have an extra hop at once --- a middle leg with two port-address endpoints, the shape this row exists to unblock (tree: B contains C and E; C contains D; E contains F; tie D to F)", () => {
        const result = buildCrossingLegs({
            subjectId: D_ID,
            targetId: F_ID,
            commonAncestor: B_ID,
            subjectPath: [C_ID, B_ID],
            targetPath: [E_ID, B_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('built')
        if (result.verdict !== 'built') return
        expect(result.steps).toHaveLength(5)

        const [addPortC, legDtoC, addPortE, legEtoF, finalLeg] = result.steps
        expect(addPortC).toMatchObject({ kind: 'addCrossingPort', hostId: C_ID, port: { fromHostId: B_ID, kind: 'Custom', exteriorRelationLabel: 'to' } })
        expect(addPortE).toMatchObject({ kind: 'addCrossingPort', hostId: E_ID, port: { fromHostId: B_ID, kind: 'Custom', exteriorRelationLabel: 'to' } })
        if (addPortC.kind !== 'addCrossingPort' || addPortE.kind !== 'addCrossingPort') return
        const portC = addPortC.port.portId
        const portE = addPortE.port.portId

        expect(legDtoC).toEqual({ kind: 'establishRelation', subjectId: D_ID, targetId: { owner: C_ID, port: portC }, hostId: C_ID, relationKind: 'Custom', relationLabel: 'to' })
        expect(legEtoF).toEqual({ kind: 'establishRelation', subjectId: { owner: E_ID, port: portE }, targetId: F_ID, hostId: E_ID, relationKind: 'Custom', relationLabel: 'to' })
        // The connecting leg: both endpoints are port addresses, no primitive endpoint anywhere.
        expect(finalLeg).toEqual({
            kind: 'establishRelation',
            subjectId: { owner: C_ID, port: portC },
            targetId: { owner: E_ID, port: portE },
            hostId: B_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
    })

    it('PV1-6: a genuine 3-shard chain on one side (cup on tray on table, tied to a string in the room) --- two chained ports, deeper than one extra hop', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [TRAY_ID, TABLE_ID, ROOM_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('built')
        if (result.verdict !== 'built') return
        expect(result.steps).toHaveLength(5)

        const [addPortTray, legTrayToCup, addPortTable, legTableToTray, finalLeg] = result.steps
        expect(addPortTray).toMatchObject({ kind: 'addCrossingPort', hostId: TRAY_ID, port: { fromHostId: TABLE_ID } })
        expect(addPortTable).toMatchObject({ kind: 'addCrossingPort', hostId: TABLE_ID, port: { fromHostId: ROOM_ID } })
        if (addPortTray.kind !== 'addCrossingPort' || addPortTable.kind !== 'addCrossingPort') return
        const portTray = addPortTray.port.portId
        const portTable = addPortTable.port.portId

        expect(legTrayToCup).toEqual({ kind: 'establishRelation', subjectId: { owner: TRAY_ID, port: portTray }, targetId: CUP_ID, hostId: TRAY_ID, relationKind: 'Custom', relationLabel: 'to' })
        expect(legTableToTray).toEqual({ kind: 'establishRelation', subjectId: { owner: TABLE_ID, port: portTable }, targetId: { owner: TRAY_ID, port: portTray }, hostId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' })
        expect(finalLeg).toEqual({ kind: 'establishRelation', subjectId: STRING_ID, targetId: { owner: TABLE_ID, port: portTable }, hostId: ROOM_ID, relationKind: 'Custom', relationLabel: 'to' })
    })

    it('PV1-6: a chain of depth 2 on the subject side and depth 1 on the target side at once, confirming the two sides do not interfere (D2 contains D; C contains D2; B contains C and E; E contains F; tie D to F)', () => {
        const result = buildCrossingLegs({
            subjectId: D_ID,
            targetId: F_ID,
            commonAncestor: B_ID,
            subjectPath: [D2_ID, C_ID, B_ID],
            targetPath: [E_ID, B_ID],
            operationKind: 'establishRelation',
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('built')
        if (result.verdict !== 'built') return
        expect(result.steps).toHaveLength(7)

        const [addPortD2, legDtoD2, addPortC, legD2toC, addPortE, legEtoF, finalLeg] = result.steps
        expect(addPortD2).toMatchObject({ kind: 'addCrossingPort', hostId: D2_ID, port: { fromHostId: C_ID } })
        expect(addPortC).toMatchObject({ kind: 'addCrossingPort', hostId: C_ID, port: { fromHostId: B_ID } })
        expect(addPortE).toMatchObject({ kind: 'addCrossingPort', hostId: E_ID, port: { fromHostId: B_ID } })
        if (addPortD2.kind !== 'addCrossingPort' || addPortC.kind !== 'addCrossingPort' || addPortE.kind !== 'addCrossingPort') return
        const portD2 = addPortD2.port.portId
        const portC = addPortC.port.portId
        const portE = addPortE.port.portId

        expect(legDtoD2).toEqual({ kind: 'establishRelation', subjectId: D_ID, targetId: { owner: D2_ID, port: portD2 }, hostId: D2_ID, relationKind: 'Custom', relationLabel: 'to' })
        expect(legD2toC).toEqual({ kind: 'establishRelation', subjectId: { owner: D2_ID, port: portD2 }, targetId: { owner: C_ID, port: portC }, hostId: C_ID, relationKind: 'Custom', relationLabel: 'to' })
        expect(legEtoF).toEqual({ kind: 'establishRelation', subjectId: { owner: E_ID, port: portE }, targetId: F_ID, hostId: E_ID, relationKind: 'Custom', relationLabel: 'to' })
        expect(finalLeg).toEqual({
            kind: 'establishRelation',
            subjectId: { owner: C_ID, port: portC },
            targetId: { owner: E_ID, port: portE },
            hostId: B_ID,
            relationKind: 'Custom',
            relationLabel: 'to',
        })
    })

    it('PV1-6: dissolving a genuine crossing still reports notYetImplemented, deeper than one hop', () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [TRAY_ID, TABLE_ID, ROOM_ID],
            operationKind: 'dissolveRelation',
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
