import type { EphemeraAreaId, EphemeraCharacterId, EphemeraConceptId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { unpointedBindingOf } from '../../ludicGraph/presenceParent'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { containmentPopulationSteps, rootStep } from './containmentPopulationSteps'

const AREA_ID = 'AREA#Overworld' as EphemeraAreaId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const FEATURE_ID = 'FEATURE#Counter' as EphemeraFeatureId
const OBJECT_ID = 'OBJECT#Cup' as EphemeraObjectId
const SHELF_ID = 'OBJECT#Shelf' as EphemeraObjectId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

// An Area keeps one hostless remainder; a room's binding into it is a carve-out naming that
// remainder, with no members.
const areaRoot = presenceBindingNode('Base')
const areaPointer = { host: AREA_ID, presence: areaRoot.universalKey }
const areaCarveOut = (name = 'binding-1') => presenceBindingNode(name, areaPointer, { members: [] })

describe('containmentPopulationSteps (cache-time containment population)', () => {
    it('emits the binding and kind steps when nothing is populated yet; the room binds into its Area as an empty carve-out naming the Area\'s root (the binding step adds the node)', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps).toEqual([
            { kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresences: [areaPointer], cover: { members: [] }, presenceUuid: expect.any(String) },
            { kind: 'setHostingKind', hostId: AREA_ID, memberId: ROOM_ID, hostingKind: 'PartOf' },
        ])
    })

    it('emits nothing when everything is already populated (the idempotency obligation)', () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID, hostingKind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [areaCarveOut()] })

        expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([])
    })

    it('emits only the presence-binding and kind steps when the node is already a member', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID }] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'setHostingKind'])
    })

    it('rewrites a correct binding in place when the parent lacks the node (a partially populated state): the step adds the node', () => {
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot] })
        const carveOut = areaCarveOut()
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [carveOut] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps).toEqual([
            { kind: 'repairPresenceBinding', hostId: ROOM_ID, presenceId: carveOut.universalKey, fromHostPresences: [areaPointer], cover: { members: [] } },
            { kind: 'setHostingKind', hostId: AREA_ID, memberId: ROOM_ID, hostingKind: 'PartOf' },
        ])
    })

    it('emits only the presence-binding step when the containment kind already holds', () => {
        const parentGraph = testLudicGraph(AREA_ID, {
            nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID, hostingKind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding'])
    })

    it('does not mistake a presence binding from a different parent for this one', () => {
        const otherAreaId = 'AREA#Elsewhere' as EphemeraAreaId
        const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID }] })
        const childGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('binding-1', otherAreaId, { members: [] })] })

        const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'setHostingKind'])
    })

    describe('the room rule: every room keeps one hostless remainder, which its children point at', () => {
        it('rootStep mints the remainder for a room with none, and the returned graph already holds it', () => {
            const { step, graph } = rootStep(ROOM_ID, testLudicGraph(ROOM_ID, { nodes: [] }))

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresences: [], presenceUuid: expect.any(String) })
            expect(unpointedBindingOf(graph)?.universalKey).toBe(`PRESENCE#${step!.presenceUuid}`)
        })

        it('rootStep mints the fixed PRESENCE#Base, and treats a legacy uuid-named hostless remainder as already rooted', () => {
            const { step, graph } = rootStep(ROOM_ID, testLudicGraph(ROOM_ID, { nodes: [] }))
            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresences: [], presenceUuid: 'Base' })
            expect(graph.presenceNodes.map((node) => node.universalKey)).toEqual(['PRESENCE#Base'])

            expect(rootStep(ROOM_ID, testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('legacy-uuid')] })).step).toBeUndefined()
        })

        it('rootStep mints a room\'s remainder even when the room already holds its Area carve-out', () => {
            const { step } = rootStep(ROOM_ID, testLudicGraph(ROOM_ID, { nodes: [areaCarveOut()] }))

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresences: [], presenceUuid: expect.any(String) })
        })

        it('rootStep mints an Area\'s hostless remainder, and leaves one that has it unchanged', () => {
            const { step } = rootStep(AREA_ID, testLudicGraph(AREA_ID, { nodes: [] }))
            const rooted = testLudicGraph(AREA_ID, { nodes: [areaRoot] })

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: AREA_ID, fromHostPresences: [], presenceUuid: expect.any(String) })
            expect(rootStep(AREA_ID, rooted)).toEqual({ graph: rooted })
        })

        it('rootStep leaves a room that has one unchanged', () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('Base')] })

            expect(rootStep(ROOM_ID, roomGraph)).toEqual({ graph: roomGraph })
        })

        it('rootStep mints a hostless root for a non-room parent with no binding at all, and leaves a bound one unchanged', () => {
            const { step } = rootStep(FEATURE_ID, testLudicGraph(FEATURE_ID, { nodes: [] }))
            const placed = testLudicGraph(FEATURE_ID, { nodes: [presenceBindingNode('counter-in-cafe', ROOM_ID)] })

            expect(step).toEqual({ kind: 'addPresenceBinding', hostId: FEATURE_ID, fromHostPresences: [], presenceUuid: expect.any(String) })
            expect(rootStep(FEATURE_ID, placed)).toEqual({ graph: placed })
        })

        it('a Feature parent with no binding yet gets a root its child names, so no host-only pointer is written', () => {
            const childFeatureId = 'FEATURE#Espresso' as EphemeraFeatureId
            const root = rootStep(FEATURE_ID, testLudicGraph(FEATURE_ID, { nodes: [] }))

            const steps = containmentPopulationSteps(FEATURE_ID, childFeatureId, root.graph, testLudicGraph(childFeatureId, { nodes: [] })) as any[]

            expect(steps.find(({ kind }) => kind === 'addPresenceBinding').fromHostPresences).toEqual([{
                host: FEATURE_ID,
                presence: `PRESENCE#${root.step!.presenceUuid}`,
            }])
        })

        it('points a Feature at the room\'s remainder and mints no second one', () => {
            const remainder = presenceBindingNode('Base')
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID }] })
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [] })

            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph) as any[]

            expect(steps.filter(({ kind }) => kind === 'addPresenceBinding')).toEqual([
                expect.objectContaining({ hostId: FEATURE_ID, fromHostPresences: [{ host: ROOM_ID, presence: remainder.universalKey }] }),
            ])
        })
    })

    describe('a child\'s first binding is its Base', () => {
        const parentGraph = () => testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode('Base'), { tag: 'Feature', universalKey: FEATURE_ID }] })

        it('mints PRESENCE#Base for a child holding no binding at all', () => {
            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph(), testLudicGraph(FEATURE_ID, { nodes: [] }))
            expect(steps.find(({ kind }) => kind === 'addPresenceBinding')).toEqual(expect.objectContaining({ hostId: FEATURE_ID, presenceUuid: 'Base' }))
        })

        it('mints a fresh id for a further binding, beside one the child already holds elsewhere', () => {
            const elsewhere = presenceBindingNode('Base', { host: 'ROOM#Other' as any, presence: 'PRESENCE#Base' as any }, { members: [] })
            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph(), testLudicGraph(FEATURE_ID, { nodes: [elsewhere] }))
            const added = steps.find(({ kind }) => kind === 'addPresenceBinding') as any
            expect(added.presenceUuid).not.toBe('Base')
        })

        it('names a further binding as the caller asks (a fixture builder), and ignores the name for a first binding', () => {
            const elsewhere = presenceBindingNode('Base', { host: 'ROOM#Other' as any, presence: 'PRESENCE#Base' as any }, { members: [] })
            const further = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph(), testLudicGraph(FEATURE_ID, { nodes: [elsewhere] }), { bindingName: 'inHall' })
            expect(further.find(({ kind }) => kind === 'addPresenceBinding')).toEqual(expect.objectContaining({ presenceUuid: 'inHall' }))

            const first = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph(), testLudicGraph(FEATURE_ID, { nodes: [] }), { bindingName: 'inHall' })
            expect(first.find(({ kind }) => kind === 'addPresenceBinding')).toEqual(expect.objectContaining({ presenceUuid: 'Base' }))
        })
    })

    describe('repair: a binding in the wrong shape is rewritten in place, keeping its id', () => {
        it('repairs a pointer naming only the host once the parent binding exists', () => {
            const remainder = presenceBindingNode('Base')
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID, hostingKind: 'PartOf' }],
            })
            const hostOnly = presenceBindingNode('feature-binding', { host: ROOM_ID, presence: 'PRESENCE#gone' as any })
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [hostOnly] })

            expect(containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: FEATURE_ID,
                presenceId: hostOnly.universalKey,
                fromHostPresences: [{ host: ROOM_ID, presence: remainder.universalKey }],
                cover: hostOnly.cover,
            }])
        })

        it('repairs a room\'s Area binding that lists members to an empty carve-out', () => {
            const parentGraph = testLudicGraph(AREA_ID, {
                nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID, hostingKind: 'PartOf' }],
            })
            const wrong = presenceBindingNode('binding-1', AREA_ID, { members: [{ host: FEATURE_ID, presence: 'PRESENCE#stove-in-kitchen' as any }] })
            const childGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Feature', universalKey: FEATURE_ID }, wrong] })

            expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: ROOM_ID,
                presenceId: wrong.universalKey,
                fromHostPresences: [areaPointer],
                cover: { members: [] },
            }])
        })

        it('repairs a stored host-only Room-in-Area carve-out to name the Area\'s root', () => {
            const parentGraph = testLudicGraph(AREA_ID, {
                nodes: [areaRoot, { tag: 'Room', universalKey: ROOM_ID, hostingKind: 'PartOf' }],
            })
            const hostOnly = presenceBindingNode('binding-1', { host: AREA_ID, presence: 'PRESENCE#gone' as any }, { members: [] })
            const childGraph = testLudicGraph(ROOM_ID, { nodes: [hostOnly] })

            expect(containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: ROOM_ID,
                presenceId: hostOnly.universalKey,
                fromHostPresences: [areaPointer],
                cover: { members: [] },
            }])
        })

        it('repairs a pointer that names no parent binding once the parent has one', () => {
            const remainder = presenceBindingNode('Base')
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID, hostingKind: 'PartOf' }],
            })
            const hostOnly = presenceBindingNode('feature-binding', { host: ROOM_ID, presence: 'PRESENCE#gone' as any })
            const stale = { ...hostOnly, fromHostPresences: [{ host: ROOM_ID, presence: 'PRESENCE#gone' as any }] }
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [stale] })

            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)

            expect(steps.map(({ kind }) => kind)).toEqual(['repairPresenceBinding'])
        })

        it('is a true no-op once repaired', () => {
            const remainder = presenceBindingNode('Base')
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID, hostingKind: 'PartOf' }],
            })
            const childGraph = testLudicGraph(FEATURE_ID, {
                nodes: [presenceBindingNode('feature-binding', { host: ROOM_ID, presence: remainder.universalKey })],
            })

            expect(containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)).toEqual([])
        })
    })

    describe('first placement re-points a hostless root rather than minting beside it', () => {
        const remainder = presenceBindingNode('Base')

        it('re-points a Feature\'s hostless root (minted while it was a parent) in place, keeping its id', () => {
            const featureRoot = presenceBindingNode('counter-root')
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(FEATURE_ID, { nodes: [featureRoot] })

            const steps = containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph)

            expect(steps.filter(({ kind }) => kind === 'repairPresenceBinding' || kind === 'addPresenceBinding')).toEqual([{
                kind: 'repairPresenceBinding',
                hostId: FEATURE_ID,
                presenceId: featureRoot.universalKey,
                fromHostPresences: [{ host: ROOM_ID, presence: remainder.universalKey }],
                cover: featureRoot.cover,
            }])
        })

        it('re-points an unplaced Object\'s hostless root: a hostless binding is not live', () => {
            const cupRoot = presenceBindingNode('cup-root')
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [cupRoot] })

            const steps = containmentPopulationSteps(ROOM_ID, OBJECT_ID, parentGraph, childGraph)

            expect(steps.map(({ kind }) => kind)).toEqual(['repairPresenceBinding', 'setHostingKind'])
            expect(steps[0]).toEqual(expect.objectContaining({ presenceId: cupRoot.universalKey }))
        })

        it('never re-points a Room\'s remainder: a Room adds its Area carve-out beside it', () => {
            const roomRoot = presenceBindingNode('Base')
            const parentGraph = testLudicGraph(AREA_ID, { nodes: [areaRoot] })
            const childGraph = testLudicGraph(ROOM_ID, { nodes: [roomRoot] })

            const steps = containmentPopulationSteps(AREA_ID, ROOM_ID, parentGraph, childGraph)

            expect(steps.filter(({ kind }) => kind === 'repairPresenceBinding' || kind === 'addPresenceBinding')).toEqual([
                { kind: 'addPresenceBinding', hostId: ROOM_ID, fromHostPresences: [areaPointer], cover: { members: [] }, presenceUuid: expect.any(String) },
            ])
        })
    })

    describe('authored Objects: placed In the parent, only if not live anywhere', () => {
        const remainder = presenceBindingNode('Base')

        it('places an Object under a Room: binding at the remainder (which adds the node), and an In kind', () => {
            const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            expect(containmentPopulationSteps(ROOM_ID, OBJECT_ID, parentGraph, childGraph)).toEqual([
                { kind: 'addPresenceBinding', hostId: OBJECT_ID, fromHostPresences: [{ host: ROOM_ID, presence: remainder.universalKey }], presenceUuid: expect.any(String) },
                { kind: 'setHostingKind', hostId: ROOM_ID, memberId: OBJECT_ID, hostingKind: 'In' },
            ])
        })

        it('places an Object under an Object', () => {
            const shelfBinding = presenceBindingNode('Base', ROOM_ID)
            const parentGraph = testLudicGraph(SHELF_ID, { nodes: [shelfBinding] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            expect(containmentPopulationSteps(SHELF_ID, OBJECT_ID, parentGraph, childGraph)).toEqual([
                expect.objectContaining({ kind: 'addPresenceBinding', fromHostPresences: [{ host: SHELF_ID, presence: shelfBinding.universalKey }] }),
                { kind: 'setHostingKind', hostId: SHELF_ID, memberId: OBJECT_ID, hostingKind: 'In' },
            ])
        })

        it('places an Object under a Character Held, the kind its arrival gives', () => {
            const parentGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('Base')] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            const steps = containmentPopulationSteps(CHARACTER_ID, OBJECT_ID, parentGraph, childGraph)

            expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'setHostingKind'])
            expect(steps[1]).toEqual(expect.objectContaining({ hostingKind: 'Held', hostId: CHARACTER_ID }))
        })

        it('emits steps that apply: an Object placed under a Character arrives Held', () => {
            const parentGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('Base')] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            const steps = containmentPopulationSteps(CHARACTER_ID, OBJECT_ID, parentGraph, childGraph)
            const outcome = applyStepSequenceCore(steps, new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([[CHARACTER_ID, parentGraph], [OBJECT_ID, childGraph]]))

            expect(outcome.verdict).toBe('legal')
            expect(outcome.verdict === 'legal' && outcome.graphs.get(CHARACTER_ID)?.hostingKindOf(OBJECT_ID)).toBe('Held')
        })

        it('places into a fixture actor\'s hand: one Base binding in a Room, the child names it, Held, and the actor keeps one binding', () => {
            const actorGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('Base', ROOM_ID)] })
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            const steps = containmentPopulationSteps(CHARACTER_ID, OBJECT_ID, actorGraph, childGraph)
            expect(steps[0]).toEqual(expect.objectContaining({
                kind: 'addPresenceBinding',
                hostId: OBJECT_ID,
                fromHostPresences: [{ host: CHARACTER_ID, presence: parentRemainderKey(CHARACTER_ID) }],
            }))

            const outcome = applyStepSequenceCore(steps, new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
                [ROOM_ID, roomGraph], [CHARACTER_ID, actorGraph], [OBJECT_ID, childGraph],
            ]))
            expect(outcome.verdict).toBe('legal')
            expect(outcome.verdict === 'legal' && outcome.graphs.get(CHARACTER_ID)?.hostingKindOf(OBJECT_ID)).toBe('Held')
            expect(outcome.verdict === 'legal' && outcome.graphs.get(CHARACTER_ID)?.presenceNodes.length).toBe(1)
        })

        it('refuses an actor whose one binding is not Base (a hand-written fixture\'s inRoom): nothing written', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
            const actorGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('inRoom', ROOM_ID)] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            expect(containmentPopulationSteps(CHARACTER_ID, OBJECT_ID, actorGraph, childGraph)).toEqual([])
            expect(warn).toHaveBeenCalledTimes(1)
            warn.mockRestore()
        })

        it('refuses a parent with no Base, however many bindings it has: nothing written, since the child has no binding to name', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
            const parentGraph = testLudicGraph(SHELF_ID, { nodes: [presenceBindingNode('a'), presenceBindingNode('b')] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            expect(containmentPopulationSteps(SHELF_ID, OBJECT_ID, parentGraph, childGraph)).toEqual([])
            expect(warn).toHaveBeenCalledTimes(1)
            warn.mockRestore()
        })

        it('names the parent\'s Base when it holds Base among several bindings', () => {
            const parentGraph = testLudicGraph(SHELF_ID, { nodes: [presenceBindingNode('Base', ROOM_ID), presenceBindingNode('other', ROOM_ID)] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

            expect(containmentPopulationSteps(SHELF_ID, OBJECT_ID, parentGraph, childGraph)[0]).toEqual(expect.objectContaining({
                kind: 'addPresenceBinding',
                fromHostPresences: [{ host: SHELF_ID, presence: parentRemainderKey(SHELF_ID) }],
            }))
        })

        it('emits nothing on a rerun over populated state', () => {
            const parentGraph = testLudicGraph(ROOM_ID, {
                nodes: [remainder, { tag: 'Object', universalKey: OBJECT_ID, hostingKind: 'In' }],
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
            const parentGraph = testLudicGraph(roomB, { nodes: [presenceBindingNode('Base')] })
            const childGraph = testLudicGraph(OBJECT_ID, { nodes: [presenceBindingNode('cup-binding', ROOM_ID)] })

            expect(containmentPopulationSteps(roomB, OBJECT_ID, parentGraph, childGraph)).toEqual([])
        })
    })
})

describe('containmentPopulationSteps with a Concept on either side (the pairing rule at ingest)', () => {
    const CONCEPT_ID = 'CONCEPT#MoonbaseControlSystem' as EphemeraConceptId
    const LIBRARY_ID = 'CONCEPT#DesignLibrary' as EphemeraConceptId
    const TERMINAL_ID = 'OBJECT#Terminal1' as EphemeraObjectId
    const base = presenceBindingNode('Base')
    const roomRoot = presenceBindingNode('Base')

    it('binds a Concept nested under a Room as a further binding, keeping its hostless Base, and stores the member as Associated', () => {
        const parentGraph = testLudicGraph(ROOM_ID, { nodes: [roomRoot] })
        const childGraph = testLudicGraph(CONCEPT_ID, { nodes: [base] })

        const steps = containmentPopulationSteps(ROOM_ID, CONCEPT_ID, parentGraph, childGraph)

        expect(steps).toEqual([
            { kind: 'addPresenceBinding', hostId: CONCEPT_ID, fromHostPresences: [{ host: ROOM_ID, presence: roomRoot.universalKey }], presenceUuid: expect.any(String) },
            { kind: 'setHostingKind', hostId: ROOM_ID, memberId: CONCEPT_ID, hostingKind: 'Associated' },
        ])
    })

    it('places a never-placed Object listed under a Concept as Associated, under the Concept\'s Base', () => {
        const parentGraph = testLudicGraph(CONCEPT_ID, { nodes: [base] })
        const childGraph = testLudicGraph(TERMINAL_ID, { nodes: [] })

        const steps = containmentPopulationSteps(CONCEPT_ID, TERMINAL_ID, parentGraph, childGraph)

        expect(steps).toEqual([
            { kind: 'addPresenceBinding', hostId: TERMINAL_ID, fromHostPresences: [{ host: CONCEPT_ID, presence: base.universalKey }], presenceUuid: 'Base' },
            { kind: 'setHostingKind', hostId: CONCEPT_ID, memberId: TERMINAL_ID, hostingKind: 'Associated' },
        ])
    })

    it('skips an Object that is already live in a room, as under any other parent (authored content is not handled until later)', () => {
        const parentGraph = testLudicGraph(CONCEPT_ID, { nodes: [base] })
        const childGraph = testLudicGraph(TERMINAL_ID, { nodes: [presenceBindingNode('binding-1', ROOM_ID, { members: [] })] })

        expect(containmentPopulationSteps(CONCEPT_ID, TERMINAL_ID, parentGraph, childGraph)).toEqual([])
    })

    it('nests a Concept in a Concept PartOf, not Associated', () => {
        const parentGraph = testLudicGraph(CONCEPT_ID, { nodes: [base] })
        const childGraph = testLudicGraph(LIBRARY_ID, { nodes: [presenceBindingNode('Base')] })

        const steps = containmentPopulationSteps(CONCEPT_ID, LIBRARY_ID, parentGraph, childGraph)

        expect(steps[steps.length - 1]).toEqual({ kind: 'setHostingKind', hostId: CONCEPT_ID, memberId: LIBRARY_ID, hostingKind: 'PartOf' })
    })
})

describe('containmentPopulationSteps with a kind the caller chooses (a fixture builder\'s placement)', () => {
    const remainder = presenceBindingNode('Base')

    it('places an Object On its Room', () => {
        const parentGraph = testLudicGraph(ROOM_ID, { nodes: [remainder] })
        const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

        expect(containmentPopulationSteps(ROOM_ID, OBJECT_ID, parentGraph, childGraph, { hostingKind: 'On' })).toEqual([
            { kind: 'addPresenceBinding', hostId: OBJECT_ID, fromHostPresences: [{ host: ROOM_ID, presence: remainder.universalKey }], presenceUuid: expect.any(String) },
            { kind: 'setHostingKind', hostId: ROOM_ID, memberId: OBJECT_ID, hostingKind: 'On' },
        ])
    })

    it('places an Object Held by a Character when asked to', () => {
        const parentGraph = testLudicGraph(CHARACTER_ID, { nodes: [presenceBindingNode('Base')] })
        const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

        const steps = containmentPopulationSteps(CHARACTER_ID, OBJECT_ID, parentGraph, childGraph, { hostingKind: 'Held' })

        expect(steps[1]).toEqual({ kind: 'setHostingKind', hostId: CHARACTER_ID, memberId: OBJECT_ID, hostingKind: 'Held' })
    })

    it('emits nothing on a rerun over a child already On, with On passed', () => {
        const parentGraph = testLudicGraph(ROOM_ID, {
            nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID, hostingKind: 'On' }],
        })
        const childGraph = testLudicGraph(FEATURE_ID, {
            nodes: [presenceBindingNode('Base', { host: ROOM_ID, presence: remainder.universalKey })],
        })

        expect(containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph, { hostingKind: 'On' })).toEqual([])
    })

    it('changes only the kind of a child present with another', () => {
        const parentGraph = testLudicGraph(ROOM_ID, {
            nodes: [remainder, { tag: 'Feature', universalKey: FEATURE_ID, hostingKind: 'PartOf' }],
        })
        const childGraph = testLudicGraph(FEATURE_ID, {
            nodes: [presenceBindingNode('Base', { host: ROOM_ID, presence: remainder.universalKey })],
        })

        expect(containmentPopulationSteps(ROOM_ID, FEATURE_ID, parentGraph, childGraph, { hostingKind: 'On' })).toEqual([
            { kind: 'setHostingKind', hostId: ROOM_ID, memberId: FEATURE_ID, hostingKind: 'On' },
        ])
    })

    it.each([
        ['In on a Character host', CHARACTER_ID, 'In'],
        ['Associated between two physical components', ROOM_ID, 'Associated'],
    ] as const)('throws on a kind the pairing rule refuses: %s', (_, parentId, hostingKind) => {
        const parentGraph = testLudicGraph(parentId, { nodes: [presenceBindingNode('Base')] })
        const childGraph = testLudicGraph(OBJECT_ID, { nodes: [] })

        expect(() => containmentPopulationSteps(parentId, OBJECT_ID, parentGraph, childGraph, { hostingKind })).toThrow(/not legal/)
    })
})
