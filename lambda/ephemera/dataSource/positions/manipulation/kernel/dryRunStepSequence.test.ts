import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { dryRunStepSequence } from './dryRunStepSequence'
import { applyStepSequenceCore } from './applyStepSequenceCore'
import type { MutationKernelStep } from './kernelStep'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const trayId = 'OBJECT#Tray' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Cafe' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const graphFixture = (
    ...entries: [EphemeraMembershipHostId, EphemeraLudicGraph][]
): Map<EphemeraMembershipHostId, EphemeraLudicGraph> => new Map(entries)

describe('dryRunStepSequence', () => {
    it('legal: matches applyStepSequenceCore run directly against the same fetched graphs', async () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [{ tag: 'Object', universalKey: trayId }] })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, destGraph])
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]

        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => graphs.get(hostId)!,
        })

        expect(outcome).toEqual(applyStepSequenceCore(steps, graphs))
        expect(outcome.verdict).toBe('legal')
    })

    it('stale/hostNotInFootprint: a footprint host the fetcher cannot actually supply a graph for', async () => {
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]

        // roomId is in the footprint (transferMembership contributes fromHostIds directly) but the
        // fetcher returns nothing for it --- the real-world case being a host that no longer exists.
        // dryRunStepSequence must forward that gap through to applyStepSequenceCore's own
        // hostNotInFootprint check rather than throwing on the missing entry itself.
        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => (hostId === characterId ? destGraph : (undefined as unknown as EphemeraLudicGraph)),
        })

        expect(outcome).toEqual({ verdict: 'stale', reasonCode: 'hostNotInFootprint' })
    })

    it('stale/staleTransferCandidate: entity absent from the fetched source graph', async () => {
        const sourceGraph = testLudicGraph(roomId, { nodes: [] })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, destGraph])
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]

        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => graphs.get(hostId)!,
        })

        expect(outcome).toEqual({ verdict: 'stale', reasonCode: 'staleTransferCandidate' })
    })

    it('repairable: an unresolved Against boundary edge propagates the full repair descriptor', async () => {
        const sourceGraph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object', universalKey: trayId },
                { tag: 'Object', universalKey: tableId },
            ],
            edges: [{ tag: 'Relational', from: trayId, to: tableId, kind: 'Against' }],
        })
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, destGraph])
        // Bug-injection, mirroring applyStepSequenceCore.test.ts: no paired dissolveRelation step.
        const steps: MutationKernelStep[] = [
            { kind: 'transferMembership', entityIds: new Set([trayId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]

        const outcome = await dryRunStepSequence(steps, {
            getCurrentHost: () => undefined,
            getGraph: async (hostId) => graphs.get(hostId)!,
        })

        expect(outcome).toEqual({
            verdict: 'repairable',
            reasonCode: 'unresolvedDissolveEdge',
            authority: 'mechanical',
            repair: {
                kind: 'dissolveRelationalEdge',
                hostId: roomId,
                edge: { from: trayId, to: tableId, kind: 'Against' },
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
        const destGraph = testLudicGraph(characterId, { nodes: [] })
        const graphs = graphFixture([roomId, sourceGraph], [characterId, destGraph])
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => graphs.get(hostId)!)
        // Two steps sharing the same footprint hosts (a two-entity transfer expressed as one step
        // plus a capture on the same source host) --- both touch `roomId`.
        const steps: MutationKernelStep[] = [
            { kind: 'capture', captureId: 'before', hostId: roomId },
            { kind: 'transferMembership', entityIds: new Set([trayId, tableId]), fromHostIds: new Set([roomId]), toHostId: characterId },
        ]

        const outcome = await dryRunStepSequence(steps, { getCurrentHost: () => undefined, getGraph })

        expect(outcome.verdict).toBe('legal')
        expect(getGraph).toHaveBeenCalledTimes(2)
        expect(getGraph).toHaveBeenCalledWith(roomId)
        expect(getGraph).toHaveBeenCalledWith(characterId)
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
