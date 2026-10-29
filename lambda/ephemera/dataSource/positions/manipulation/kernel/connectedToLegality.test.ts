import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { connectedToViolation } from './connectedToLegality'

const rope = 'OBJECT#Rope' as EphemeraObjectId
const strandA = 'OBJECT#StrandA' as EphemeraObjectId
const strandB = 'OBJECT#StrandB' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const plate = 'OBJECT#Plate' as EphemeraObjectId
const lab = 'ROOM#Lab' as EphemeraRoomId
const object = (universalKey: EphemeraObjectId, hostingKind?: 'In' | 'PartOf' | 'SectionOf') => ({ tag: 'Object' as const, universalKey, ...(hostingKind ? { hostingKind } : {}) })
const port = (owner: EphemeraObjectId | EphemeraRoomId, name: string) => ({ owner, port: `PRESENCE#${name}` as EphemeraPresenceNodeId })

const partlessRope = testLudicGraph(rope, { nodes: [object(rope), presenceBindingNode('pA', lab), presenceBindingNode('pB', lab)] })
const partedRope = testLudicGraph(rope, {
    nodes: [object(rope), object(strandA, 'PartOf'), object(strandB, 'SectionOf'), presenceBindingNode('pA', lab)],
})
const labGraph = testLudicGraph(lab, {
    nodes: [{ tag: 'Room', universalKey: lab }, object(cup, 'In'), object(plate, 'In'), presenceBindingNode('Base')],
})

describe('connectedToViolation', () => {
    it('allows a binding to a binding on a partless whole', () => {
        expect(connectedToViolation(partlessRope, rope, port(rope, 'pA'), port(rope, 'pB'))).toBeUndefined()
    })

    it('allows a binding to a binding on a whole that also has named parts', () => {
        expect(connectedToViolation(partedRope, rope, port(rope, 'pA'), port(rope, 'pB'))).toBeUndefined()
    })

    it('allows a part to a part, of either composition kind (PartOf and SectionOf)', () => {
        expect(connectedToViolation(partedRope, rope, strandA, strandB)).toBeUndefined()
    })

    it('allows a part to a binding, and the whole itself to a part', () => {
        expect(connectedToViolation(partedRope, rope, strandA, port(rope, 'pA'))).toBeUndefined()
        expect(connectedToViolation(partedRope, rope, rope, strandB)).toBeUndefined()
    })

    it('refuses two siblings held in a room, naming the one that is not a part', () => {
        expect(connectedToViolation(labGraph, lab, cup, plate)).toMatch(/OBJECT#Cup.*not a part of ROOM#Lab/)
    })

    it('refuses a part joined to a sibling that is not a part', () => {
        const withStranger = testLudicGraph(rope, {
            nodes: [object(rope), object(strandA, 'PartOf'), object(cup, 'In')],
        })
        expect(connectedToViolation(withStranger, rope, strandA, cup)).toMatch(/OBJECT#Cup/)
    })

    it('refuses a binding of another host', () => {
        expect(connectedToViolation(partlessRope, rope, port(rope, 'pA'), port(cup, 'pA'))).toMatch(/OBJECT#Cup/)
    })

    it('refuses a crossing port address the whole owns: a crossing port is not a binding', () => {
        expect(connectedToViolation(partedRope, rope, { owner: rope, port: 'PORT-ab6129d' }, port(rope, 'pA'))).toMatch(/crossing port of OBJECT#Rope/)
    })

    it('allows an own binding spelled bare, to a binding address or to a part', () => {
        const ownBinding = 'PRESENCE#pA' as EphemeraPresenceNodeId
        expect(connectedToViolation(partlessRope, rope, ownBinding, port(rope, 'pB'))).toBeUndefined()
        expect(connectedToViolation(partedRope, rope, strandA, ownBinding)).toBeUndefined()
    })

    it('refuses a part of a part, which lives in the part\'s own graph rather than the whole\'s', () => {
        const nested = 'OBJECT#Fibre' as EphemeraObjectId
        expect(connectedToViolation(partedRope, rope, strandA, nested)).toMatch(/OBJECT#Fibre/)
    })
})
