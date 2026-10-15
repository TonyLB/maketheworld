import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { dryRunStepSequence } from './dryRunStepSequence'
import { applyStepSequenceCore } from './applyStepSequenceCore'
import type { MutationKernelStep } from './kernelStep'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const moveTrayOut = (mover: EphemeraMembershipHostId = trayId): MutationKernelStep => (
    { kind: 'movePresenceBinding', hostId: mover, presence: 'PRESENCE#p1' as any, from: { host: roomId, presence: parentRemainderKey(roomId) }, to: { host: characterId, presence: parentRemainderKey(characterId) } }
)
const moverGraph = (mover: EphemeraMembershipHostId) => testLudicGraph(mover, { nodes: [presenceBindingNode('p1', roomId)] })
const characterHost = () => testLudicGraph(characterId, { nodes: [presenceBindingNode(parentRemainderKey(characterId))] })

const graphFixture = (
    ...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map(entries)

describe('dryRunStepSequence', () => {
    it('legal: matches applyStepSequenceCore run directly against the same fetched graphs', async () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, characterHost()], [trayId, moverGraph(trayId)])
        const steps: MutationKernelStep[] = [moveTrayOut()]

        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => graphs.get(hostId)!,
        })

        expect(outcome).toEqual(applyStepSequenceCore(steps, graphs))
        expect(outcome.verdict).toBe('legal')
    })

    it('never fetches a host the sequence creates; the create step seeds it', async () => {
        const roomGraph = testLudicGraph(roomId, { nodes: [presenceBindingNode(parentRemainderKey(roomId))] })
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => {
            if (hostId !== roomId) {
                throw new Error(`unexpected fetch of ${hostId}`)
            }
            return roomGraph
        })
        const steps: MutationKernelStep[] = [
            { kind: 'createComponent', hostId: trayId, presenceUuid: 'born', meta: { EphemeraId: trayId, DataCategory: 'Meta::Object', stableKey: 'tray' } },
            { kind: 'movePresenceBinding', hostId: trayId, presence: 'PRESENCE#born' as any, from: null, to: { host: roomId, presence: parentRemainderKey(roomId) } },
        ]

        const outcome = await dryRunStepSequence(steps, { getCurrentHost: () => undefined, getGraph })

        expect(outcome.verdict).toBe('legal')
        expect(getGraph.mock.calls.map(([hostId]) => hostId)).toEqual([roomId])
    })

    it('stale/hostNotInFootprint: a footprint host the fetcher cannot actually supply a graph for', async () => {
        const destGraph = characterHost()
        const steps: MutationKernelStep[] = [moveTrayOut()]

        // roomId is in the footprint (a move contributes the host it leaves directly) but the
        // fetcher returns nothing for it --- the real-world case being a host that no longer exists.
        // dryRunStepSequence must forward that gap through to applyStepSequenceCore's own
        // hostNotInFootprint check rather than throwing on the missing entry itself.
        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => (hostId === characterId ? destGraph : hostId === trayId ? moverGraph(trayId) : (undefined as unknown as EphemeraLudicGraph)),
        })

        expect(outcome).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
    })

    it('stale/staleTransferCandidate: entity absent from the fetched source graph', async () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [] })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, characterHost()], [trayId, moverGraph(trayId)])
        const steps: MutationKernelStep[] = [moveTrayOut()]

        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => graphs.get(hostId)!,
        })

        expect(outcome).toEqual({ verdict: 'stale', reasonCode: 'staleTransferCandidate' })
    })

    it('repairable: an undecidable Custom boundary edge propagates the full repair descriptor', async () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Custom', relationLabel: 'against' }],
        })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, characterHost()], [trayId, moverGraph(trayId)])
        // Bug-injection, mirroring applyStepSequenceCore.test.ts: no paired dissolveRelation step.
        const steps: MutationKernelStep[] = [moveTrayOut()]

        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => graphs.get(hostId)!,
        })

        expect(outcome).toEqual({
            verdict: 'repairable',
            reasonCode: 'undecidableInteractionEdge',
            authority: 'worldChanging',
            repair: {
                kind: 'classifyCustomRelation',
                hostId: roomId,
                edge: { from: trayId, to: tableId, kind: 'Custom', relationLabel: 'against' },
            },
        })
    })

    it('fetches each footprint host exactly once, not once per step', async () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
        })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, characterHost()], [trayId, moverGraph(trayId)], [tableId, moverGraph(tableId)])
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => graphs.get(hostId)!)
        // Three steps sharing the same footprint hosts (two moves plus a capture on the same
        // source host) --- all touch `roomId`.
        const steps: MutationKernelStep[] = [
            { kind: 'capture', captureId: 'before', hostId: roomId },
            moveTrayOut(trayId),
            moveTrayOut(tableId),
        ]

        const outcome = await dryRunStepSequence(steps, { getCurrentHost: () => undefined, getGraph, getRoomCharacters: async () => [] })

        expect(outcome.verdict).toBe('legal')
        expect(getGraph).toHaveBeenCalledTimes(4)
        expect(getGraph).toHaveBeenCalledWith(roomId)
        expect(getGraph).toHaveBeenCalledWith(characterId)
        expect(getGraph).toHaveBeenCalledWith(trayId)
        expect(getGraph).toHaveBeenCalledWith(tableId)
    })

    it('takes no transactWrite dependency --- there is no write path to reach', () => {
        // Type-level guard, not a runtime assertion: dryRunStepSequence's deps type has no
        // transactWrite field, unlike CommitStepSequenceDeps. Documented here rather than left
        // implicit, since the whole point of this stage is that it cannot write.
        const deps: Parameters<typeof dryRunStepSequence>[1] = {
            getCurrentHost: () => undefined,
        }
        expect('transactWrite' in deps).toBe(false)
    })
})
