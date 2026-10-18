import type { EphemeraCharacterId, EphemeraFeatureId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { coverageViolationsOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { computeStepSequenceFootprint } from '../kernel/computeStepSequenceFootprint'
import { migrateBaseBinding } from './migrateBaseBinding'

const ROOM = 'ROOM#Kitchen' as EphemeraRoomId
const STOVE = 'FEATURE#Stove' as EphemeraFeatureId
const ALPHA = 'CHARACTER#Alpha' as EphemeraCharacterId
const OLD = 'PRESENCE#kitchen-root' as any

/** Stored data from before monotone covers: the Room's root holds a Remainder; a feature and a bystander point at it. */
const storedWorld = () => new Map<EphemeraMembershipHostId, EphemeraLudicGraph>([
    [ROOM, testLudicGraph(ROOM, {
        nodes: [{ tag: 'Room', universalKey: ROOM }, { tag: 'Feature', universalKey: STOVE }, presenceBindingNode(OLD, undefined, { members: [{ tag: 'Remainder' }] })],
    })],
    [STOVE, testLudicGraph(STOVE, { nodes: [{ tag: 'Feature', universalKey: STOVE }, presenceBindingNode('stove-b', { host: ROOM, presence: OLD }, { members: [] })] })],
    [ALPHA, testLudicGraph(ALPHA as any, { nodes: [presenceBindingNode('alpha-b', { host: ROOM, presence: OLD }, { members: [] })] })],
])

const viewOf = (graph: EphemeraLudicGraph) => ({ hostId: graph.hostId, nodeIds: [...graph.nodeIds], presenceNodes: graph.presenceNodes })

describe('the Base migration, planned and applied by the real kernel', () => {
    it('ends with PRESENCE#Base, an explicit cover and renamed pointers; a second plan is empty', () => {
        const before = storedWorld()
        const steps = migrateBaseBinding(before.get(ROOM)!, (host) => before.get(host), [ALPHA])
        expect(steps).toHaveLength(1)

        // The footprint is computed from the steps alone, and holds exactly what the rename needs.
        const footprint = computeStepSequenceFootprint(steps, () => undefined)
        expect(footprint).toEqual(new Set([ROOM, STOVE, ALPHA]))

        const outcome = applyStepSequenceCore(steps, before)
        if (outcome.verdict !== 'legal') {
            throw new Error(`expected legal, got ${outcome.reasonCode}`)
        }
        const room = outcome.graphs.get(ROOM)!
        expect(room.presenceNodes).toEqual([
            presenceBindingNode(BASE_PRESENCE_ID, undefined, { members: [{ host: STOVE, presence: 'PRESENCE#stove-b' }] } as any),
        ])
        expect(outcome.graphs.get(STOVE)!.presenceNodes[0].fromHostPresence).toEqual({ host: ROOM, presence: BASE_PRESENCE_ID })
        expect(outcome.graphs.get(ALPHA)!.presenceNodes[0].fromHostPresence).toEqual({ host: ROOM, presence: BASE_PRESENCE_ID })
        expect(coverageViolationsOf(viewOf(room))).toEqual({ uncovered: [], hostlessBindings: [], badUnplaced: [] })

        expect(migrateBaseBinding(room, (host) => outcome.graphs.get(host), [ALPHA])).toEqual([])
    })
})
