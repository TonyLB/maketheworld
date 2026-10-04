import { v4 as uuidv4 } from 'uuid'

import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraLudicTerminalId, HostRelationalEdgeKind, RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { edgeKindAndLabelFrom, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** A crossing leg's kind/label pairing. No longer narrowed via `Exclude<HostRelationalEdgeKind,
 * 'Present'>` (PN-14, presenceNodes Slice 3): `'Present'` retired from `HostRelationalEdgeKind`
 * entirely, so the exclusion is vacuous -- and as of Slice 7a there is no longer a presence-kind
 * port literal (`EphemeraPresencePortKind`, since retired) for the exclusion to have protected
 * against in the first place. */
type CrossingKindAndLabel = RelationalKindAndLabel<HostRelationalEdgeKind>

import type { MutationKernelStep } from '../../../../positions/manipulation/kernel/kernelStep'
import type { RelationalChainStep } from './findRelationalChain'

const portFieldsFrom = (kindAndLabel: CrossingKindAndLabel): Pick<EphemeraCrossingPort, 'kind' | 'exteriorRelationLabel'> =>
    kindAndLabel.relationKind === 'Custom'
        ? { kind: 'Custom', exteriorRelationLabel: kindAndLabel.relationLabel }
        : { kind: kindAndLabel.relationKind }

/**
 * The establish-side chain builder,
 * consuming `findShardBoundary`'s `'crossed'` result. It returns the chain as a value ---
 * every leg with its host, and every port it crosses --- in `findRelationalChain`'s
 * `RelationalChainStep` shape, so establish and dissolve share one chain type; lowering it to
 * kernel steps is `lowerRelationalChain`'s job, below.
 *
 * `subjectPath`/`targetPath` are ordered nearest-endpoint-first, ending at `commonAncestor` (see `findShardBoundary.ts`); their length is the number of hosts crossed,
 * inclusive of the common ancestor itself. `h_i`'s own immediate container is exactly the next
 * path entry, `h_{i+1}` --- that is how `findShardBoundary`/`pathToAncestor` built the path.
 *
 * **The original single-hop code's two blocks are generalized into loops**, one hop at a time,
 * each mirroring the other:
 *
 * - **Ascending (subject -> ancestor), source-to-ancestor order:** for each `subjectPath` entry
 *   but the last (`h0, ..., h(Ns-2)`), mint a fresh `EphemeraCrossingPort` at `hostId: hi` with
 *   `fromHostId: h(i+1)` (`hi`'s own immediate container), then push an edge `{ from:
 *   <running subject-side terminal>, to: <this hop's fresh port address> }` at `hostId: hi` ---
 *   the known/interior side stays `from`, the freshly-minted-and-further-out port is
 *   `to`. The running terminal becomes that port for the next hop.
 * - **Descending (target -> ancestor), *target-path's own native* nearest-target-first order:**
 *   the mirror, one hop at a time over `targetPath`'s entries but the last (`k0, ..., k(Nt-2)`,
 *   i.e. innermost/nearest-target first): mint a port at `hostId: ki`, `fromHostId: k(i+1)`, then
 *   push an edge `{ from: <this hop's fresh port address>, to: <running target-side
 *   terminal> }` at `hostId: ki` --- reversed from the ascending loop, matching the original
 *   single-hop target-side block's own convention exactly.
 * - **The chain's own designated relation, pushed last regardless of depth on either side:**
 *   `{ from: <ascending loop's final terminal, or the raw subjectId if that loop never ran>,
 *   to: <descending loop's final terminal, or the raw targetId if that loop never ran> }` at
 *   `hostId: commonAncestor`. This one step also covers the fully-degenerate case (both loops
 *   empty): a single portless edge `subjectId -> targetId` at `commonAncestor` --- today's
 *   existing portless behavior, unchanged.
 *
 * Each port is pushed immediately before the leg that references it,
 * matching the original single-hop code's shape --- confirmed that strict interleaving
 * is not actually required for correctness (`addCrossingPort` and edge steps commute:
 * `applyStepSequenceCore`'s `hostsOf`/`confirmCarriedHost` and
 * `EphemeraLudicGraph.bothObjectsOnGraph` all resolve a port-address endpoint to its **owner**
 * only, never its `portId`, so neither step kind depends on the other having already run), but
 * the convention keeps the chain's own order legible.
 *
 * Establish only: a dissolve's chain already exists, so it is found (`findRelationalChain`),
 * not built. No `chainId` is minted (deferred until one edge can have several chains).
 */
export const buildCrossingLegs = (
    input: {
        subjectId: EphemeraPositionAdjacencyContainedId
        targetId: EphemeraPositionAdjacencyContainedId
        commonAncestor: EphemeraMembershipHostId
        subjectPath: EphemeraMembershipHostId[]
        targetPath: EphemeraMembershipHostId[]
    } & CrossingKindAndLabel
): RelationalChainStep[] => {
    const { subjectId, targetId, commonAncestor, subjectPath, targetPath } = input
    const kindAndLabel: CrossingKindAndLabel = input.relationKind === 'Custom'
        ? { relationKind: 'Custom', relationLabel: input.relationLabel }
        : { relationKind: input.relationKind }
    const edgeKindAndLabel = edgeKindAndLabelFrom(kindAndLabel)

    const chain: RelationalChainStep[] = []

    const mintPortAt = (hostId: EphemeraMembershipHostId, fromHostId: EphemeraMembershipHostId): EphemeraLudicTerminalId => {
        const portId = uuidv4()
        const port: EphemeraCrossingPort = { portId, fromHostId, ...portFieldsFrom(kindAndLabel) }
        chain.push({ type: 'port', hostId, port })
        return { owner: hostId, port: portId }
    }

    // One hop at a time, source-to-ancestor order, minting this hop's port and pushing the leg
    // that references it immediately after. `edgeFor` is the one place the two sides diverge:
    // ascending (subject), the known/running terminal stays `from` and the fresh port takes
    // `to`; descending (target, walked in `targetPath`'s own native nearest-target-first
    // order), that's reversed.
    const mintChain = (
        path: EphemeraMembershipHostId[],
        initialEntry: EphemeraLudicTerminalId,
        edgeFor: (port: EphemeraLudicTerminalId, running: EphemeraLudicTerminalId) => { from: EphemeraLudicTerminalId; to: EphemeraLudicTerminalId }
    ): EphemeraLudicTerminalId =>
        path.slice(0, -1).reduce((entry, hostId, i) => {
            const port = mintPortAt(hostId, path[i + 1]!)
            chain.push({ type: 'edge', hostId, edge: { ...edgeFor(port, entry), ...edgeKindAndLabel } })
            return port
        }, initialEntry)

    const subjectEntry = mintChain(subjectPath, subjectId, (port, running) => ({ from: running, to: port }))
    const targetEntry = mintChain(targetPath, targetId, (port, running) => ({ from: port, to: running }))

    // The chain's own designated relation, pushed last regardless of depth on either side:
    // connects the two sides' resulting terminals at their shared common ancestor.
    chain.push({ type: 'edge', hostId: commonAncestor, edge: { from: subjectEntry, to: targetEntry, ...edgeKindAndLabel } })

    return chain
}

/**
 * Lowers a relational chain to kernel steps, for establish or dissolve alike --- the one
 * chain type differs between the two only here: a port becomes `addCrossingPort` or
 * `removeCrossingPort`, an edge `establishRelation` or `dissolveRelation`, each in the chain's
 * own order. That order carries no data dependency either way: a port step and a relational
 * step referencing that port commute, since every validation of a port-address endpoint
 * resolves it to its owner only, never its `portId` (`applyStepSequenceCore`'s
 * `hostsOf`/`confirmCarriedHost`, `EphemeraLudicGraph.bothObjectsOnGraph`).
 *
 * A dissolve chain carries everything needed to remove it, however deep: every id it names
 * was already committed by some earlier establish, and the kernel rechecks each step at commit.
 */
export const lowerRelationalChain = (
    chain: readonly RelationalChainStep[],
    operationKind: 'establishRelation' | 'dissolveRelation'
): MutationKernelStep[] =>
    chain.map((step): MutationKernelStep => {
        if (step.type === 'edge') {
            return {
                kind: operationKind,
                subjectId: step.edge.from,
                targetId: step.edge.to,
                hostId: step.hostId,
                ...relationKindAndLabelOf(step.edge),
            }
        }
        return operationKind === 'establishRelation'
            ? { kind: 'addCrossingPort', hostId: step.hostId, port: step.port }
            : { kind: 'removeCrossingPort', hostId: step.hostId, portId: step.port.portId }
    })
