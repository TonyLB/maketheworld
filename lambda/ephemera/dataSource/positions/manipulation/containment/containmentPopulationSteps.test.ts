import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { hostlessRemainderOf } from '../../ludicGraph/presenceParent'
import { containmentPopulationSteps, roomRootStep } from './containmentPopulationSteps'

const AREA_ID = 'AREA#Overworld' as EphemeraAreaId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const FEATURE_ID = 'FEATURE#Counter' as EphemeraFeatureId
const OBJECT_ID = 'OBJECT#Cup' as EphemeraObjectId
const SHELF_ID = 'OBJECT#Shelf' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

// A room's Area binding is a carve-out: pointer at the Area (which holds no binding), no members.
const areaCarveOut = (name = 'binding-1') => presenceBindingNode(name, { host: AREA_ID }, { members: [] })

describe('containmentPopulationSteps (cache-time containment population)', () => {
    it('emits all three steps when nothing is populated yet; the room binds into its Area as an empty carve-out', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps).toEqual([
            { kind: 'transferMembership', entityId: ROOM_ID, fromHostIds: new Set(), toHostId: AREA_ID },
            { kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresence: { host: AREA_ID }, cover: { members: [] }, presenceUuid: expect.any(String) },
            { kind: 'establishRelation', subjectId: ROOM_ID, targetId: AREA_ID, hostId: AREA_ID, relationKind: 'PartOf' },
        ])
    })

    it('emits nothing when everything is already populated (the idempotency obligation)', () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
            edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [areaCarveOut()] })

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
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [areaCarveOut()] })

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
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('binding-1', { host: otherAreaId }, { members: [] })] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'establishRelation'])
    })

    describe('the room rule: every room keeps one hostless remainder, which its children point at', () => {
        it('roomRootStep mints the remainder for a room with none, and the returned graph already holds it', () => {
            const { step, graph } = roomRootStep(ROOM_ID, testLudicGraph(ROOM_ID, { nodes: [] }))

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: ROOM_ID, presenceUuid: expect.any(String) })
            expect(hostlessRemainderOf(graph)?.universalKey).toBe(`PRESENCE#${step!.presenceUuid}`)
        })

        it('roomRootStep leaves a room that has one, and any non-room, unchanged', () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('room-remainder')] })
            const featureGraph = testLudicGraph(FEATURE_ID, { nodes: [] })

            expect(roomRootStep(ROOM_ID, roomGraph)).toEqual({ graph: roomGraph })
            expect(roomRootStep(FEATURE_ID, featureGraph)).toEqual({ graph: featureGraph })
        })

        it('points a Feature at the room\'s remainder and mints no second one', () => {
            const remainder = presenceBindingNode('room-remainder')
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID }] })
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [] })

            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph) as any[]

            expect(steps.filter(({ kind }) => kind === 'addPresenceBinding')).toEqual([
                expect.objectContaining({ hostId: FEATURE_ID, fromHostPresence: { host: ROOM_ID, presence: remainder.universalKey } }),
            ])
        })
    })

    describe('repair: a binding in the wrong shape is rewritten in place, keeping its id', () => {
        it('repairs a pointer naming only the host once the parent binding exists', () => {
            const remainder = presenceBindingNode('room-remainder')
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID }],
                edges: [{ tag: 'Relational', from: FEATURE_ID, to: ROOM_ID, kind: 'PartOf' }],
            })
            const hostOnly = presenceBindingNode('feature-binding', { host: ROOM_ID })
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [hostOnly] })

            expect(containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: FEATURE_ID,
                presenceId: hostOnly.universalKey,
                fromHostPresence: { host: ROOM_ID, presence: remainder.universalKey },
                cover: hostOnly.cover,
            }])
        })

        it('repairs a room\'s sole-remainder Area binding to an empty carve-out', () => {
            const parentGraph = testLudicGraph(AREA_ID, {
                nodes: [{ tag: 'Room', universalKey: ROOM_ID }],
                edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
            })
            const wrong = presenceBindingNode('binding-1', { host: AREA_ID })
            const childGraph = testLudicGraph(ROOM_ID, { nodes: [wrong] })

            expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: ROOM_ID,
                presenceId: wrong.universalKey,
                fromHostPresence: { host: AREA_ID },
                cover: { members: [] },
            }])
        })

        it('repairs a pointer that names no parent binding once the parent has one', () => {
            const remainder = presenceBindingNode('room-remainder')
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID }],
                edges: [{ tag: 'Relational', from: FEATURE_ID, to: ROOM_ID, kind: 'PartOf' }],
            })
            const hostOnly = presenceBindingNode('feature-binding', { host: ROOM_ID })
            const stale = { ...hostOnly, fromHostPresence: { host: ROOM_ID } }
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [stale] })

            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)

            expect(steps.map(({ kind }) => kind)).toEqual(['repairPresenceBinding'])
        })

        it('is a true no-op once repaired', () => {
            const remainder = presenceBindingNode('room-remainder')
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID }],
                edges: [{ tag: 'Relational', from: FEATURE_ID, to: ROOM_ID, kind: 'PartOf' }],
            })
            const childGraph = testLudicGraph(FEATURE_ID, {
                nodes: [presenceBindingNode('feature-binding', { host: ROOM_ID, presence: remainder.universalKey })],
            })

            expect(containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)).toEqual([])
        })
    })

    describe('authored Objects: placed In the parent, only if not live anywhere', () => {
        const remainder = presenceBindingNode('room-remainder')

        it('places an Object under a Room: node, binding at the remainder, and an In edge', () => {
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            expect(containmentPopulationSteps(ROOM_ID, OBJECT_ID, parentGraph, childGraph)).toEqual([
                { kind: 'transferMembership', entityId: OBJECT_ID, fromHostIds: new Set(), toHostId: ROOM_ID },
                { kind: 'addPresenceBinding', hostId: OBJECT_ID, fromHostPresence: { host: ROOM_ID, presence: remainder.universalKey }, presenceUuid: expect.any(String) },
                { kind: 'establishRelation', subjectId: OBJECT_ID, targetId: ROOM_ID, hostId: ROOM_ID, relationKind: 'In' },
            ])
        })

        it('places an Object under an Object', () => {
            const shelfBinding = presenceBindingNode('shelf-binding', ROOM_ID)
            const parentGraph = testLudicGraph(SHELF_ID, { nodes: [shelfBinding] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            expect(containmentPopulationSteps(SHELF_ID, OBJECT_ID, parentGraph, childGraph)).toEqual([
                expect.objectContaining({ kind: 'transferMembership', toHostId: SHELF_ID }),
                expect.objectContaining({ kind: 'addPresenceBinding', fromHostPresence: { host: SHELF_ID, presence: shelfBinding.universalKey } }),
                expect.objectContaining({ kind: 'establishRelation', relationKind: 'In', targetId: SHELF_ID }),
            ])
        })

        it('places an Object under a Character by the same rule, with no character branch', () => {
            const parentGraph = testLudicGraph(CHARACTER_ID, { nodes: [] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            const steps = containmentPopulationSteps(CHARACTER_ID, OBJECT_ID, parentGraph, childGraph)

            expect(steps.map((step) => step.kind)).toEqual(['transferMembership', 'addPresenceBinding', 'establishRelation'])
            expect(steps[2]).toEqual(expect.objectContaining({ relationKind: 'In', targetId: CHARACTER_ID }))
        })

        it('emits nothing on a rerun over populated state', () => {
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Object', universalKey: OBJECT_ID }],
                edges: [{ tag: 'Relational', from: OBJECT_ID, to: ROOM_ID, kind: 'In' }],
            })
            const childGraph = testLudicGraph(OBJECT_ID, {
                nodes: [presenceBindingNode('cup-binding', { host: ROOM_ID, presence: remainder.universalKey })],
            })

            expect(containmentPopulationSteps(ROOM_ID, OBJECT_ID, parentGraph, childGraph)).toEqual([])
        })

        it('does not put an Object back after a player moved it out', () => {
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [presenceBindingNode('cup-binding', CHARACTER_ID)] })

            expect(containmentPopulationSteps(ROOM_ID, OBJECT_ID, parentGraph, childGraph)).toEqual([])
        })

        it('leaves an Object where it is live when the author lists it under another parent', () => {
            const roomB = 'ROOM#Kitchen' as EphemeraRoomId
            const parentGraph = testLudicGraph(roomB, { nodes: [presenceBindingNode('kitchen-remainder')] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [presenceBindingNode('cup-binding', ROOM_ID)] })

            expect(containmentPopulationSteps(roomB, OBJECT_ID, parentGraph, childGraph)).toEqual([])
        })
    })
})
