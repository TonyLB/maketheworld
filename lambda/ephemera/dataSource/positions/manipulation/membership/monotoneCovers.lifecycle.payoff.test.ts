import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { classifyPresenceCoverDrift, coverRebuildsFor, coverageViolationsOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { presenceGraphViewOf } from '../../ludicGraph/presenceParent'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { partMoveSteps } from './resolvePresenceMoves'
import type { MutationKernelStep } from '../kernel/kernelStep'

/**
 * The monotone-covers payoff, through the real compiler and the real kernel apply: the whole
 * life of a placed thing --- create, place, move, move part away, move it back, disconnect --- writes
 * only explicit entries. After every step no binding holds a `Remainder`, the coverage invariant
 * holds with Base present, and every parent's cover lists its arrivals with no `healPresenceCover`.
 */

const roomA = 'ROOM#Bridge' as EphemeraRoomId
const roomB = 'ROOM#Galley' as EphemeraRoomId
const roomC = 'ROOM#Deck' as EphemeraRoomId
const plank = 'OBJECT#Plank' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const base = BASE_PRESENCE_ID as EphemeraPresenceNodeId
const second = 'PRESENCE#plank-second' as EphemeraPresenceNodeId

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

const viewOf = presenceGraphViewOf

const roomGraph = (room: EphemeraRoomId) => testLudicGraph(room, { nodes: [presenceBindingNode(base, undefined, { members: [] })] })

const createStep = (hostId: EphemeraObjectId, stableKey: string): MutationKernelStep => ({
    kind: 'createComponent',
    hostId,
    meta: { EphemeraId: hostId, DataCategory: 'Meta::Object', stableKey },
} as MutationKernelStep)

const reparent = (
    hostId: EphemeraObjectId,
    presence: EphemeraPresenceNodeId,
    from: { host: EphemeraMembershipHostId; presence: EphemeraPresenceNodeId } | null,
    to: { host: EphemeraMembershipHostId; presence: EphemeraPresenceNodeId } | null
): MutationKernelStep[] => [{
    kind: 'reparentPresenceBinding',
    hostId,
    presence,
    ...(from ? { lose: [from] } : {}),
    ...(to ? { gain: [to] } : {}),
}]

describe('the whole life of a placed thing writes only explicit entries', () => {
    let graphs: Graphs
    const run = (steps: MutationKernelStep[]) => {
        const outcome = applyStepSequenceCore(steps, graphs)
        if (outcome.verdict !== 'legal') {
            throw new Error(`expected a legal outcome, got ${JSON.stringify(outcome)}`)
        }
        graphs = new Map(outcome.graphs)
        expectConsistent()
    }
    const expectConsistent = () => {
        const memberOf = (id: string) => graphs.has(id as EphemeraMembershipHostId) ? viewOf(graphs.get(id as EphemeraMembershipHostId)!) : undefined
        for (const [hostId, graph] of graphs) {
            expect(graph.presenceNodes.some(({ universalKey }) => universalKey === BASE_PRESENCE_ID)).toBe(true)
            expect([hostId, coverageViolationsOf(viewOf(graph))]).toEqual([hostId, { uncovered: [], hostlessBindings: [], badUnplaced: [] }])
            expect([hostId, classifyPresenceCoverDrift(viewOf(graph), memberOf).findings]).toEqual([hostId, []])
            expect([hostId, coverRebuildsFor(viewOf(graph), (id) => memberOf(id)!)]).toEqual([hostId, []])
        }
    }
    const coverOf = (host: EphemeraMembershipHostId, presence: EphemeraPresenceNodeId) => (
        graphs.get(host)!.presenceNodes.find(({ universalKey }) => universalKey === presence)!.cover.members
    )
    const entryFor = (host: EphemeraObjectId, presence: EphemeraPresenceNodeId) => ({ host, presence })

    beforeAll(() => {
        graphs = new Map([[roomA, roomGraph(roomA)], [roomB, roomGraph(roomB)], [roomC, roomGraph(roomC)]])
    })

    it('creates a thing holding only an empty Base, and nests another thing in it', () => {
        run([createStep(plank, 'plank'), createStep(cup, 'cup')])
        expect(coverOf(plank, base)).toEqual([])

        run(reparent(cup, base, null, { host: plank, presence: base }))
        expect(coverOf(plank, base)).toEqual([entryFor(cup, base)])
    })

    it('places it: the room cover lists the arrival', () => {
        run(reparent(plank, base, null, { host: roomA, presence: base }))
        expect(coverOf(roomA, base)).toEqual([entryFor(plank, base)])
    })

    it('moves it: the entry leaves one room cover and arrives in the other', () => {
        run(reparent(plank, base, { host: roomA, presence: base }, { host: roomB, presence: base }))
        expect(coverOf(roomA, base)).toEqual([])
        expect(coverOf(roomB, base)).toEqual([entryFor(plank, base)])
    })

    it('moves part of it away: the cup rides a new binding of the plank', () => {
        const binding = graphs.get(plank)!.presenceNodes.find(({ universalKey }) => universalKey === base)!
        run(partMoveSteps({
            hostId: plank,
            binding,
            part: [entryFor(cup, base)],
            presenceUuid: second.replace('PRESENCE#', ''),
            lose: [{ host: roomB, presence: base }],
            gain: [{ host: roomC, presence: base }],
        }))
        expect(coverOf(roomC, base)).toEqual([entryFor(plank, second)])
        expect(coverOf(plank, second)).toEqual([entryFor(cup, base)])
        expect(coverOf(plank, base)).toEqual([])
        expect(graphs.get(cup)!.presenceNodes[0].fromHostPresences).toEqual([{ host: plank, presence: second }])
    })

    it('moves it back: the two bindings rejoin under the first room', () => {
        run([
            ...reparent(plank, second, { host: roomC, presence: base }, { host: roomB, presence: base }),
            { kind: 'joinPresenceBindings', hostId: plank, into: base, toJoin: [second], cascadeHosts: [cup] },
        ])
        expect(graphs.get(plank)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([base])
        expect(coverOf(plank, base)).toEqual([entryFor(cup, base)])
        expect(coverOf(roomC, base)).toEqual([])
        expect(coverOf(roomB, base)).toEqual([entryFor(plank, base)])
    })

    it('disconnects it: the pointer goes, Base stays, and the room cover drops the entry', () => {
        run(reparent(plank, base, { host: roomB, presence: base }, null))
        expect(graphs.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresences }) => [universalKey, fromHostPresences[0]])).toEqual([[base, undefined]])
        expect(coverOf(roomB, base)).toEqual([])
        expect(coverOf(plank, base)).toEqual([entryFor(cup, base)])
    })
})
