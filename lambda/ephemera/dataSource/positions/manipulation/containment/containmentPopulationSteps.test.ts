import type { EphemeraAreaId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../../ludicGraph/testFixtures'
import { containmentPopulationSteps } from './containmentPopulationSteps'

const AREA_ID = 'AREA#Overworld' as EphemeraAreaId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

describe('containmentPopulationSteps (cache-time containment population)', () => {
    it('emits all three steps when nothing is populated yet', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps).toEqual([
            { kind: 'transferMembership', entityIds: new Set([ROOM_ID]), fromHostIds: new Set(), toHostId: AREA_ID },
            { kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostId: AREA_ID, presenceUuid: expect.any(String) },
            { kind: 'establishRelation', subjectId: ROOM_ID, targetId: AREA_ID, hostId: AREA_ID, relationKind: 'PartOf' },
        ])
    })

    it('emits nothing when everything is already populated (the idempotency obligation)', () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
            edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_ID, {
            nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#binding-1', fromHostId: AREA_ID, cover: { tag: 'Full' } }],
        })

        expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([])
    })

    it('emits only the presence-binding and edge steps when the node is already a member', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [{ tag: 'Room', universalKey: ROOM_ID }] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'establishRelation'])
    })

    it('emits only the node and edge steps when the presence binding already exists', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [] })
        const childGraph = testLudicGraph(ROOM_ID, {
            nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#binding-1', fromHostId: AREA_ID, cover: { tag: 'Full' } }],
        })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['transferMembership', 'establishRelation'])
    })

    it('emits only the node and presence-binding steps when the containment edge already exists', () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [],
            edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['transferMembership', 'addPresenceBinding'])
    })

    it('does not mistake a presence binding from a different parent for this one', () => {
        const otherAreaId = 'AREA#Elsewhere' as EphemeraAreaId
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [{ tag: 'Room', universalKey: ROOM_ID }] })
        const childGraph = testLudicGraph(ROOM_ID, {
            nodes: [{ tag: 'Presence', universalKey: 'PRESENCE#binding-1', fromHostId: otherAreaId, cover: { tag: 'Full' } }],
        })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'establishRelation'])
    })
})
