import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { GroundedPresence } from '../../../actions/enrich/objectManipulation/plan/planStep'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { presencesHolding } from '../../ludicGraph/presenceSubGraph'
import { childParentBindingIdOf } from '../../ludicGraph/presenceParent'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import { applyStepSequenceCore } from './applyStepSequenceCore'
import type { MutationKernelStep } from './kernelStep'

/**
 * Characterization for presenceMoves PM-1: a destination's `groundedPresence` names the bucket of the
 * HOLDING host in which the destination is seen, not the destination's own binding. The destination's
 * binding is "the one whose `fromHostPresences` name that bucket". These tests pin when that is unique
 * (every shape the kernel writes today) and when it is not (two bindings under one parent bucket,
 * which only a split produces).
 */

const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const rugId = 'OBJECT#Rug' as EphemeraObjectId
const matOneId = 'OBJECT#MatOne' as EphemeraObjectId
const matTwoId = 'OBJECT#MatTwo' as EphemeraObjectId

const graphsMap = (...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]) => new Map(entries)

/** Bindings of the destination whose pointer names a seen bucket (a bare room id matches by host). */
const bindingsUnder = (destGraph: EphemeraLudicGraph, bucket: GroundedPresence): EphemeraLudicGraphStructureNode[] => (
    destGraph.presenceNodes.filter(({ fromHostPresences }) => fromHostPresences.some((parent) => (
        typeof bucket === 'string'
            ? parent.host === bucket
            : parent.host === bucket.host && parent.presence === bucket.presence
    )))
)

/** The destination's binding(s) for every bucket where `destId` is seen in `holdingGraph`. */
const destinationBindings = (holdingGraph: EphemeraLudicGraph, destId: EphemeraObjectId, destGraph: EphemeraLudicGraph) => (
    (presencesHolding(holdingGraph, destId) ?? []).map((bucket) => bindingsUnder(destGraph, bucket))
)

/** Places `destId` under `holdingHostId` through the real kernel, so the binding is written as a move writes it. */
const placeThroughKernel = (
    holdingGraph: EphemeraLudicGraph,
    destId: EphemeraObjectId
): EphemeraLudicGraph => {
    const steps: MutationKernelStep[] = [
        { kind: 'movePresenceBinding', hostId: destId, presence: 'PRESENCE#dest' as EphemeraPresenceNodeId, from: null, to: { host: holdingGraph.hostId, presence: childParentBindingIdOf(holdingGraph)! } },
    ]
    const outcome = applyStepSequenceCore(steps, graphsMap([destId, testLudicGraph(destId, { nodes: [presenceBindingNode('dest')] })], [holdingGraph.hostId, holdingGraph]))
    if (outcome.verdict !== 'legal') {
        throw new Error(`fixture placement was not legal: ${outcome.verdict}`)
    }
    return outcome.graphs.get(destId)!
}

describe('a destination binding from its seen bucket', () => {
    it('is unique for an object placed in a room with a remainder binding', () => {
        const roomGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object', universalKey: tableId }, presenceBindingNode(parentRemainderKey(roomId))],
        })
        const tableGraph = placeThroughKernel(roomGraph, tableId)

        const found = destinationBindings(roomGraph, tableId, tableGraph)

        expect(found).toHaveLength(1)
        expect(found[0]).toHaveLength(1)
    })

    it('is unique for an object seen in a legacy room graph with no binding (the bucket is the bare room id)', () => {
        const roomGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: tableId }] })
        const tableGraph = testLudicGraph(tableId, { nodes: [presenceBindingNode('t1', roomId)] })

        expect(presencesHolding(roomGraph, tableId)).toEqual([roomId])
        expect(destinationBindings(roomGraph, tableId, tableGraph)).toEqual([[tableGraph.presenceNodes[0]]])
    })

    it('is unique for an object held by a character', () => {
        const characterGraph = testLudicGraph(characterId, {
            nodes: [{ tag: 'Object', universalKey: tableId }, presenceBindingNode('Base', roomId)],
        })
        const tableGraph = placeThroughKernel(characterGraph, tableId)

        const found = destinationBindings(characterGraph, tableId, tableGraph)

        expect(found).toHaveLength(1)
        expect(found[0]).toHaveLength(1)
    })

    it('is unique for an object nested in another object', () => {
        const rugGraph = testLudicGraph(rugId, {
            nodes: [{ tag: 'Object', universalKey: tableId }, presenceBindingNode('Base', roomId)],
        })
        const tableGraph = placeThroughKernel(rugGraph, tableId)

        const found = destinationBindings(rugGraph, tableId, tableGraph)

        expect(found).toHaveLength(1)
        expect(found[0]).toHaveLength(1)
    })

    it('is unique per bucket when the holding host splits into several buckets', () => {
        const rugGraph = testLudicGraph(rugId, {
            nodes: [
                { tag: 'Object', universalKey: matOneId },
                { tag: 'Object', universalKey: matTwoId },
                presenceBindingNode('b1', roomId, { members: [{ host: matOneId, presence: 'PRESENCE#m1' as any }] }),
                presenceBindingNode('b2', roomId, { members: [] }),
            ],
        })
        const matOneGraph = testLudicGraph(matOneId, { nodes: [presenceBindingNode('m1', { host: rugId, presence: 'PRESENCE#b1' as any })] })

        const found = destinationBindings(rugGraph, matOneId, matOneGraph)

        expect(found).toEqual([[matOneGraph.presenceNodes[0]]])
    })

    it('is AMBIGUOUS for two bindings of one destination under the same parent bucket (what a split under one parent produces)', () => {
        const roomGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object', universalKey: tableId }, presenceBindingNode(parentRemainderKey(roomId))],
        })
        const tableGraph = testLudicGraph(tableId, {
            nodes: [presenceBindingNode('t1', roomId), presenceBindingNode('t2', roomId, { members: [] })],
        })

        const found = destinationBindings(roomGraph, tableId, tableGraph)

        expect(found).toHaveLength(1)
        expect(found[0]).toHaveLength(2)
    })
})
