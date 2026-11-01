import type { EphemeraConceptId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { alignConceptBindings } from './alignConceptBindings'
import type { AlignmentMember, AlignmentTree } from './alignConceptBindings'

const SYSTEM = 'CONCEPT#MoonbaseControlSystem' as EphemeraConceptId
const LIFE_SUPPORT = 'CONCEPT#LifeSupport' as EphemeraConceptId
const LIBRARY = 'CONCEPT#DesignLibrary' as EphemeraConceptId
const DOCKING = 'ROOM#DockingRing' as EphemeraRoomId
const MESS = 'ROOM#Mess' as EphemeraRoomId
const T1 = 'OBJECT#Terminal1' as EphemeraObjectId
const T2 = 'OBJECT#Terminal2' as EphemeraObjectId
const T3 = 'OBJECT#Terminal3' as EphemeraObjectId
const SCRUBBER = 'OBJECT#Scrubber' as EphemeraObjectId

const roomBase = (roomId: EphemeraRoomId) => ({ roomId, roomBindingId: 'PRESENCE#Base' as const })
const member = (memberId: EphemeraObjectId, ...rooms: EphemeraRoomId[]): AlignmentMember => ({
    memberId,
    graph: testLudicGraph(memberId, { nodes: rooms.map((room) => presenceBindingNode(`in-${room.slice(5)}`, room)) }),
    rooms: rooms.map(roomBase),
})
const conceptGraph = (id: EphemeraConceptId, nodes = [presenceBindingNode('Base')]) => testLudicGraph(id, { nodes })
const counter = () => { let n = 0; return () => `m${++n}` }

describe('alignConceptBindings (the pure alignment rule)', () => {
    it('gives the Docking Ring one system binding for two terminals and the mess a second; the library stays out of every room', () => {
        const tree: AlignmentTree = {
            conceptId: SYSTEM,
            graph: conceptGraph(SYSTEM),
            members: [member(T1, DOCKING), member(T2, DOCKING), member(T3, MESS)],
            parts: [{ conceptId: LIBRARY, graph: conceptGraph(LIBRARY), members: [], parts: [] }],
        }

        const steps = alignConceptBindings(tree, counter())

        const systemBindings = steps.filter((step) => step.hostId === SYSTEM)
        expect(systemBindings).toEqual([
            { kind: 'addPresenceBinding', hostId: SYSTEM, fromHostPresences: [{ host: DOCKING, presence: 'PRESENCE#Base' }], presenceUuid: 'm1' },
            { kind: 'addPresenceBinding', hostId: SYSTEM, fromHostPresences: [{ host: MESS, presence: 'PRESENCE#Base' }], presenceUuid: expect.any(String) },
        ])
        const dockingBinding = 'PRESENCE#m1'
        expect(steps.filter((step) => step.hostId === T1 || step.hostId === T2).map((step) => step.fromHostPresences)).toEqual([
            [{ host: SYSTEM, presence: dockingBinding }],
            [{ host: SYSTEM, presence: dockingBinding }],
        ])
        expect(steps.some((step) => step.hostId === LIBRARY)).toBe(false)
    })

    it('puts a nested module under the outermost system\'s room binding, its member under the module\'s', () => {
        const tree: AlignmentTree = {
            conceptId: SYSTEM,
            graph: conceptGraph(SYSTEM),
            members: [],
            parts: [{
                conceptId: LIFE_SUPPORT,
                graph: conceptGraph(LIFE_SUPPORT),
                members: [member(SCRUBBER, DOCKING)],
                parts: [],
            }],
        }

        const steps = alignConceptBindings(tree, counter())

        expect(steps.map((step) => [step.hostId, step.fromHostPresences])).toEqual([
            [SYSTEM, [{ host: DOCKING, presence: 'PRESENCE#Base' }]],
            [LIFE_SUPPORT, [{ host: SYSTEM, presence: 'PRESENCE#m1' }]],
            [SCRUBBER, [{ host: LIFE_SUPPORT, presence: 'PRESENCE#m2' }]],
        ])
    })

    it('emits nothing over already-aligned state (idempotent)', () => {
        const systemInDocking = presenceBindingNode('sys', DOCKING)
        const terminal = {
            memberId: T1,
            rooms: [roomBase(DOCKING)],
            graph: testLudicGraph(T1, { nodes: [presenceBindingNode('in-room', DOCKING), presenceBindingNode('assoc', { host: SYSTEM, presence: systemInDocking.universalKey })] }),
        }
        const tree: AlignmentTree = { conceptId: SYSTEM, graph: conceptGraph(SYSTEM, [presenceBindingNode('Base'), systemInDocking]), members: [terminal], parts: [] }

        expect(alignConceptBindings(tree, counter())).toEqual([])
    })

    it('only adds: an authored room child with no member present, and a room a member left, are left alone', () => {
        const authored = presenceBindingNode('authored', MESS)
        const tree: AlignmentTree = {
            conceptId: SYSTEM,
            graph: conceptGraph(SYSTEM, [presenceBindingNode('Base'), authored]),
            members: [member(T1, DOCKING)],
            parts: [],
        }

        const steps = alignConceptBindings(tree, counter())

        expect(steps.map((step) => step.kind)).toEqual(['addPresenceBinding', 'addPresenceBinding'])
        expect(steps.some((step) => step.fromHostPresences.some(({ host }) => host === MESS))).toBe(false)
    })
})
