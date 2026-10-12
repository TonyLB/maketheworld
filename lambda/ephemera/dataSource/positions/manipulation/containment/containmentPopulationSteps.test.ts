import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { hostlessRemainderOf } from '../../ludicGraph/presenceParent'
import { containmentPopulationSteps, rootStep } from './containmentPopulationSteps'

const AREA_ID = 'AREA#Overworld' as EphemeraAreaId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const FEATURE_ID = 'FEATURE#Counter' as EphemeraFeatureId
const OBJECT_ID = 'OBJECT#Cup' as EphemeraObjectId
const SHELF_ID = 'OBJECT#Shelf' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

// An Area keeps one hostless remainder; a room's binding into it is a carve-out naming that
// remainder, with no members.
const areaRoot = presenceBindingNode('overworld-remainder')
const areaPointer = { host: AREA_ID, presence: areaRoot.universalKey }
const areaCarveOut = (name = 'binding-1') => presenceBindingNode(name, areaPointer, { members: [] })

describe('containmentPopulationSteps (cache-time containment population)', () => {
    it('emits all three steps when nothing is populated yet; the room binds into its Area as an empty carve-out naming the Area\'s root', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps).toEqual([
            { kind: 'transferMembership', entityId: ROOM_ID, fromHostIds: new Set(), toHostId: AREA_ID },
            { kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresence: areaPointer, cover: { members: [] }, presenceUuid: expect.any(String) },
            { kind: 'establishRelation', subjectId: ROOM_ID, targetId: AREA_ID, hostId: AREA_ID, relationKind: 'PartOf' },
        ])
    })

    it('emits nothing when everything is already populated (the idempotency obligation)', () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID }],
            edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [areaCarveOut()] })

        expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([])
    })

    it('emits only the presence-binding and edge steps when the node is already a member', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID }] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'establishRelation'])
    })

    it('emits only the node and edge steps when the presence binding already exists', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [areaCarveOut()] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['transferMembership', 'establishRelation'])
    })

    it('emits only the node and presence-binding steps when the containment edge already exists', () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [areaRoot],
            edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['transferMembership', 'addPresenceBinding'])
    })

    it('does not mistake a presence binding from a different parent for this one', () => {
        const otherAreaId = 'AREA#Elsewhere' as EphemeraAreaId
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID }] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('binding-1', { host: otherAreaId }, { members: [] })] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'establishRelation'])
    })

    describe('the room rule: every room keeps one hostless remainder, which its children point at', () => {
        it('rootStep mints the remainder for a room with none, and the returned graph already holds it', () => {
            const { step, graph } = rootStep(ROOM_ID, testLudicGraph(ROOM_ID, { nodes: [] }))

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: ROOM_ID, presenceUuid: expect.any(String) })
            expect(hostlessRemainderOf(graph)?.universalKey).toBe(`PRESENCE#${step!.presenceUuid}`)
        })

        it('rootStep mints a room\'s remainder even when the room already holds its Area carve-out', () => {
            const { step } = rootStep(ROOM_ID, testLudicGraph(ROOM_ID, { nodes: [areaCarveOut()] }))

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: ROOM_ID, presenceUuid: expect.any(String) })
        })

        it('rootStep mints an Area\'s hostless remainder, and leaves one that has it unchanged', () => {
            const { step } = rootStep(AREA_ID, testLudicGraph(AREA_ID, { nodes: [] }))
            const rooted = testLudicGraph(AREA_ID, { nodes: [areaRoot] })

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: AREA_ID, presenceUuid: expect.any(String) })
            expect(rootStep(AREA_ID, rooted)).toEqual({ graph: rooted })
        })

        it('rootStep leaves a room that has one unchanged', () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('room-remainder')] })

            expect(rootStep(ROOM_ID, roomGraph)).toEqual({ graph: roomGraph })
        })

        it('rootStep mints a hostless root for a non-room parent with no binding at all, and leaves a bound one unchanged', () => {
            const { step } = rootStep(FEATURE_ID, testLudicGraph(FEATURE_ID, { nodes: [] }))
            const placed = testLudicGraph(FEATURE_ID, { nodes: [presenceBindingNode('counter-in-cafe', ROOM_ID)] })

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: FEATURE_ID, presenceUuid: expect.any(String) })
            expect(rootStep(FEATURE_ID, placed)).toEqual({ graph: placed })
        })

        it('a Feature parent with no binding yet gets a root its child names, so no host-only pointer is written', () => {
            const childFeatureId = 'FEATURE#Espresso' as EphemeraFeatureId
            const root = rootStep(FEATURE_ID, testLudicGraph(FEATURE_ID, { nodes: [] }))

            const steps = containmentPopulationSteps(FEATURE_ID, childFeatureId, root.graph, testLudicGraph(childFeatureId, { nodes: [] })) as any[]

            expect(steps.find(({ kind }) => kind === 'addPresenceBinding').fromHostPresence).toEqual({
                host: FEATURE_ID,
                presence: `PRESENCE#${root.step!.presenceUuid}`,
            })
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
                nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID }],
                edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
            })
            const wrong = presenceBindingNode('binding-1', { host: AREA_ID })
            const childGraph = testLudicGraph(ROOM_ID, { nodes: [wrong] })

            expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: ROOM_ID,
                presenceId: wrong.universalKey,
                fromHostPresence: areaPointer,
                cover: { members: [] },
            }])
        })

        it('repairs a stored host-only Room-in-Area carve-out to name the Area\'s root', () => {
            const parentGraph = testLudicGraph(AREA_ID, {
                nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID }],
                edges: [{ tag: 'Relational', from: ROOM_ID, to: AREA_ID, kind: 'PartOf' }],
            })
            const hostOnly = presenceBindingNode('binding-1', { host: AREA_ID }, { members: [] })
            const childGraph = testLudicGraph(ROOM_ID, { nodes: [hostOnly] })

            expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: ROOM_ID,
                presenceId: hostOnly.universalKey,
                fromHostPresence: areaPointer,
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

    describe('first placement re-points a hostless root rather than minting beside it', () => {
        const remainder = presenceBindingNode('room-remainder')

        it('re-points a Feature\'s hostless root (minted while it was a parent) in place, keeping its id', () => {
            const featureRoot = presenceBindingNode('counter-root')
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [featureRoot] })

            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)

            expect(steps.filter(({ kind }) => kind === 'repairPresenceBinding' || kind === 'addPresenceBinding')).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: FEATURE_ID,
                presenceId: featureRoot.universalKey,
                fromHostPresence: { host: ROOM_ID, presence: remainder.universalKey },
                cover: featureRoot.cover,
            }])
        })

        it('re-points an unplaced Object\'s hostless root: a hostless binding is not live', () => {
            const cupRoot = presenceBindingNode('cup-root')
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [cupRoot] })

            const steps = containmentPopulationSteps(ROOM_ID, OBJECT_ID, parentGraph, childGraph)

            expect(steps.map(({ kind }) => kind)).toEqual(['transferMembership', 'repairPresenceBinding', 'establishRelation'])
            expect(steps[1]).toEqual(expect.objectContaining({ presenceId: cupRoot.universalKey }))
        })

        it('never re-points a Room\'s remainder: a Room adds its Area carve-out beside it', () => {
            const roomRoot = presenceBindingNode('cafe-remainder')
            const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot] })
            const childGraph = testLudicGraph(ROOM_ID, { nodes: [roomRoot] })

            const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

            expect(steps.filter(({ kind }) => kind === 'repairPresenceBinding' || kind === 'addPresenceBinding')).toEqual([
                { kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresence: areaPointer, cover: { members: [] }, presenceUuid: expect.any(String) },
            ])
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
