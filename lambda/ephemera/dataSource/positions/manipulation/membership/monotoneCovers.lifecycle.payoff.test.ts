import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { BASE_PRESENCE_ID, isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { classifyPresenceCoverDrift, coverRebuildsFor, coverageViolationsOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from '../kernel/applyStepSequenceCore'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from '../kernel/kernelStep'
import type { MutationKernelStep } from '../kernel/kernelStep'

/**
 * monotoneCovers Slice 2b's payoff, through the real compiler and the real kernel apply: the whole
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

const viewOf = (graph: EphemeraLudicGraph): PresenceGraphView => ({
    hostId: graph.hostId,
    nodeIds: [...graph.nodeIds],
    presenceNodes: graph.presenceNodes,
})

const roomGraph = (room: EphemeraRoomId) => testLudicGraph(room, { nodes: [presenceBindingNode(base, undefined, { members: [] })] })

const createStep = (hostId: EphemeraObjectId, stableKey: string): MutationKernelStep => ({
    kind: 'createComponent',
    hostId,
    meta: { EphemeraId: hostId, DataCategory: 'Meta::Object', stableKey },
} as MutationKernelStep)

const moveSteps = (moved: EphemeraObjectId, presenceMoves: Parameters<typeof compilePositionKernelOp>[0] extends infer Op ? (Op extends { presenceMoves: infer P } ? P : never) : never, to: EphemeraMembershipHostId) => (
    compilePositionKernelOp({ kind: 'move', moved, froms: [], to, header: null, presenceMoves } as Parameters<typeof compilePositionKernelOp>[0]).steps.filter(isKernelMutationStep)
)

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
            expect([hostId, graph.presenceNodes.flatMap((node) => node.cover.members.filter(isEphemeraPresenceCoverRemainder))]).toEqual([hostId, []])
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

        run(moveSteps(cup, [{ presence: base, from: null, to: { host: plank, presence: base } }], plank))
        expect(coverOf(plank, base)).toEqual([entryFor(cup, base)])
    })

    it('places it: the room cover lists the arrival', () => {
        run(moveSteps(plank, [{ presence: base, from: null, to: { host: roomA, presence: base } }], roomA))
        expect(coverOf(roomA, base)).toEqual([entryFor(plank, base)])
    })

    it('moves it: the entry leaves one room cover and arrives in the other', () => {
        run(moveSteps(plank, [{ presence: base, from: { host: roomA, presence: base }, to: { host: roomB, presence: base } }], roomB))
        expect(coverOf(roomA, base)).toEqual([])
        expect(coverOf(roomB, base)).toEqual([entryFor(plank, base)])
    })

    it('moves part of it away: the cup rides a new binding of the plank', () => {
        run([{
            kind: 'movePresenceBinding',
            hostId: plank,
            presence: base,
            from: { host: roomB, presence: base },
            to: { host: roomC, presence: base },
            subCover: [entryFor(cup, base)],
            mintedPresence: second,
        } as MutationKernelStep])
        expect(coverOf(roomC, base)).toEqual([entryFor(plank, second)])
        expect(coverOf(plank, second)).toEqual([entryFor(cup, base)])
        expect(coverOf(plank, base)).toEqual([])
        expect(graphs.get(cup)!.presenceNodes[0].fromHostPresence).toEqual({ host: plank, presence: second })
    })

    it('moves it back: the two bindings rejoin under the first room', () => {
        run(moveSteps(plank, [{ presence: second, from: { host: roomC, presence: base }, to: { host: roomB, presence: base } }], roomB))
        expect(graphs.get(plank)!.presenceNodes.map(({ universalKey }) => universalKey)).toEqual([base])
        expect(coverOf(plank, base)).toEqual([entryFor(cup, base)])
        expect(coverOf(roomC, base)).toEqual([])
        expect(coverOf(roomB, base)).toEqual([entryFor(plank, base)])
    })

    it('disconnects it: the pointer goes, Base stays, and the room cover drops the entry', () => {
        run(moveSteps(plank, [{ presence: base, cover: { members: [entryFor(cup, base)] }, from: { host: roomB, presence: base }, to: null }], roomB))
        expect(graphs.get(plank)!.presenceNodes.map(({ universalKey, fromHostPresence }) => [universalKey, fromHostPresence])).toEqual([[base, undefined]])
        expect(coverOf(roomB, base)).toEqual([])
        expect(coverOf(plank, base)).toEqual([entryFor(cup, base)])
    })
})
