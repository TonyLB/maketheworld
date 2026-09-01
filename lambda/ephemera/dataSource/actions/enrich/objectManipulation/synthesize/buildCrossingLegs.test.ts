import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { buildCrossingLegs } from './buildCrossingLegs'

const ROOM_ID = 'ROOM#Vortex' as EphemeraRoomId
const STRING_ID = 'OBJECT#String' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const BOX_ID = 'OBJECT#Box' as EphemeraObjectId

describe('buildCrossingLegs', () => {
    it("PV1-0's own readout case: rope in room, cup on table -- exactly two legs and one crossing port, on the interior (table) side", () => {
        const result = buildCrossingLegs({
            subjectId: STRING_ID,
            targetId: CUP_ID,
            commonAncestor: ROOM_ID,
            subjectPath: [ROOM_ID],
            targetPath: [TABLE_ID, ROOM_ID],
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
            relationKind: 'Custom',
            relationLabel: 'to',
        })
        expect(roomLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: STRING_ID,
            targetId: { owner: TABLE_ID, port: portId },
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
            relationKind: 'Custom',
            relationLabel: 'to',
        })
        expect(roomLegStep).toEqual({
            kind: 'establishRelation',
            subjectId: { owner: BOX_ID, port: portId },
            targetId: CUP_ID,
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
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result).toEqual({
            verdict: 'built',
            steps: [
                { kind: 'establishRelation', subjectId: STRING_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
            ],
        })
    })

    it('zero-length target path (the target IS the common ancestor): a single leg in that host, no port minted', () => {
        const result = buildCrossingLegs({
            subjectId: CUP_ID,
            targetId: TABLE_ID,
            commonAncestor: TABLE_ID,
            subjectPath: [TABLE_ID],
            targetPath: [],
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result).toEqual({
            verdict: 'built',
            steps: [
                { kind: 'establishRelation', subjectId: CUP_ID, targetId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
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
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result).toEqual({
            verdict: 'built',
            steps: [
                { kind: 'establishRelation', subjectId: TABLE_ID, targetId: CUP_ID, relationKind: 'Custom', relationLabel: 'to' },
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
            relationKind: 'Custom',
            relationLabel: 'to',
        })

        expect(result.verdict).toBe('notYetImplemented')
    })
})
