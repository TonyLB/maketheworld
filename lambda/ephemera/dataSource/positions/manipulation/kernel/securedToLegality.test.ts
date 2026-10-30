import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { securedToViolation } from './securedToLegality'

const rope = 'OBJECT#Rope' as EphemeraObjectId
const pole = 'OBJECT#Pole' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const lab = 'ROOM#Lab' as EphemeraRoomId
const object = (universalKey: EphemeraObjectId, hostingKind?: 'In' | 'PartOf') => ({ tag: 'Object' as const, universalKey, ...(hostingKind ? { hostingKind } : {}) })

const labGraph = testLudicGraph(lab, {
    nodes: [{ tag: 'Room', universalKey: lab }, object(rope, 'In'), object(pole, 'In'), presenceBindingNode('Base')],
})
const tagGraph = testLudicGraph(rope, { nodes: [object(rope), object(pole, 'PartOf'), presenceBindingNode('pA', lab)] })

describe('securedToViolation', () => {
    it('allows two members of one graph', () => {
        expect(securedToViolation(labGraph, lab, rope, pole)).toBeUndefined()
    })

    it('allows a member to its own host root, in either direction', () => {
        expect(securedToViolation(tagGraph, rope, pole, rope)).toBeUndefined()
        expect(securedToViolation(tagGraph, rope, rope, pole)).toBeUndefined()
    })

    it('refuses a node that is not in the graph (a crossing)', () => {
        expect(securedToViolation(labGraph, lab, rope, cup)).toMatch(/OBJECT#Cup.*crossing SecuredTo/)
    })

    it('refuses an edge terminal, a binding address, a crossing port and a presence node', () => {
        expect(securedToViolation(labGraph, lab, rope, { edgeId: 'edge-a' })).toMatch(/is an edge/)
        expect(securedToViolation(tagGraph, rope, rope, { owner: rope, port: 'PRESENCE#pA' as EphemeraPresenceNodeId })).toMatch(/not a node/)
        expect(securedToViolation(tagGraph, rope, rope, { owner: rope, port: 'PORT-ab6129d' })).toMatch(/not a node/)
        expect(securedToViolation(tagGraph, rope, rope, 'PRESENCE#pA' as EphemeraPresenceNodeId)).toMatch(/not a node/)
    })
})
