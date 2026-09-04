import { v4 as uuidv4 } from 'uuid'

import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraLudicTerminalId, HostRelationalEdgeKind, RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** A crossing leg's kind/label pairing, narrowed off `'Present'` (that kind is presence ports' own --- see `EphemeraCrossingPort`). */
type CrossingKindAndLabel = RelationalKindAndLabel<Exclude<HostRelationalEdgeKind, 'Present'>>

import type { MutationKernelStep } from '../../../../positions/manipulation/kernel/kernelStep'
import type { RelationalChainStep } from './findRelationalChain'

export type BuildCrossingLegsResult =
    | { verdict: 'built'; steps: MutationKernelStep[] }
    | { verdict: 'notYetImplemented'; reason: string }

const portFieldsFrom = (kindAndLabel: CrossingKindAndLabel): Pick<EphemeraCrossingPort, 'kind' | 'exteriorRelationLabel'> =>
    kindAndLabel.relationKind === 'Custom'
        ? { kind: 'Custom', exteriorRelationLabel: kindAndLabel.relationLabel }
        : { kind: kindAndLabel.relationKind }

/**
 * PV1-3's crossing-port producer, general case, consuming `findShardBoundary`'s `'crossed'`
 * result. `subjectPath`/`targetPath` are ordered nearest-endpoint-first, ending at
 * `commonAncestor` (see `findShardBoundary.ts`); their length is the number of hosts crossed,
 * inclusive of the common ancestor itself. `h_i`'s own immediate container is exactly the next
 * path entry, `h_{i+1}` --- that is how `findShardBoundary`/`pathToAncestor` built the path.
 *
 * **PV1-6 generalizes the original single-hop code's two blocks into loops**, one hop at a time,
 * each mirroring the other:
 *
 * - **Ascending (subject -> ancestor), source-to-ancestor order:** for each `subjectPath` entry
 *   but the last (`h0, ..., h(Ns-2)`), mint a fresh `EphemeraCrossingPort` at `hostId: hi` with
 *   `fromHostId: h(i+1)` (`hi`'s own immediate container), then push an edge `{ subjectId:
 *   <running subject-side terminal>, targetId: <this hop's fresh port address>, hostId: hi }` ---
 *   the known/interior side stays `subjectId`, the freshly-minted-and-further-out port is
 *   `targetId`. The running terminal becomes that port for the next hop.
 * - **Descending (target -> ancestor), *target-path's own native* nearest-target-first order:**
 *   the mirror, one hop at a time over `targetPath`'s entries but the last (`k0, ..., k(Nt-2)`,
 *   i.e. innermost/nearest-target first): mint a port at `hostId: ki`, `fromHostId: k(i+1)`, then
 *   push an edge `{ subjectId: <this hop's fresh port address>, targetId: <running target-side
 *   terminal>, hostId: ki }` --- reversed from the ascending loop, matching the original
 *   single-hop target-side block's own convention exactly.
 * - **The chain's own designated relation, pushed last regardless of depth on either side:**
 *   `{ subjectId: <ascending loop's final terminal, or the raw subjectId if that loop never ran>,
 *   targetId: <descending loop's final terminal, or the raw targetId if that loop never ran>,
 *   hostId: commonAncestor }`. This one step also covers the fully-degenerate case (both loops
 *   empty): a single portless edge `subjectId -> targetId` at `commonAncestor` --- today's
 *   existing portless behavior, unchanged.
 *
 * Each port's `addCrossingPort` step is pushed immediately before the leg that references it,
 * matching the original single-hop code's shape --- confirmed (PV1-6) that strict interleaving
 * is not actually required for correctness (`addCrossingPort` and edge steps commute:
 * `applyStepSequenceCore`'s `hostsOf`/`confirmCarriedHost` and
 * `EphemeraLudicGraph.bothObjectsOnGraph` all resolve a port-address endpoint to its **owner**
 * only, never its `portId`, so neither step kind depends on the other having already run), but
 * the convention keeps the step array's own order legible, and matches every existing test's
 * expected step order unchanged.
 *
 * **Dissolving an actual crossing stays unbuilt and reports `notYetImplemented`**: a real
 * crossing (either path length `>= 2`) would also need to *remove* the crossing port(s) it once
 * minted, which this function only ever adds --- left for whichever slice needs it. Only the
 * no-port (portless leg) degenerate case supports dissolve today.
 *
 * `operationKind` picks `establishRelation`/`dissolveRelation` for the final step (PV1-3b-4 ---
 * the collapsed ingress seed no longer carries a sibling relational step of its own, so this
 * function is now the only source of that step for every same-host candidate, dissolves
 * included, not just the crossing ones).
 */
export const buildCrossingLegs = (
    input: {
        subjectId: EphemeraPositionAdjacencyContainedId
        targetId: EphemeraPositionAdjacencyContainedId
        commonAncestor: EphemeraMembershipHostId
        subjectPath: EphemeraMembershipHostId[]
        targetPath: EphemeraMembershipHostId[]
        operationKind: 'establishRelation' | 'dissolveRelation'
    } & CrossingKindAndLabel
): BuildCrossingLegsResult => {
    const { subjectId, targetId, commonAncestor, subjectPath, targetPath, operationKind } = input
    const kindAndLabel: CrossingKindAndLabel = input.relationKind === 'Custom'
        ? { relationKind: 'Custom', relationLabel: input.relationLabel }
        : { relationKind: input.relationKind }

    if (operationKind === 'dissolveRelation' && (subjectPath.length >= 2 || targetPath.length >= 2)) {
        return {
            verdict: 'notYetImplemented',
            reason: 'buildCrossingLegs: dissolving a relation that crosses a real shard boundary is not yet supported --- it would also need to remove the crossing port(s) this function only ever adds',
        }
    }

    const steps: MutationKernelStep[] = []

    const mintPortAt = (hostId: EphemeraMembershipHostId, fromHostId: EphemeraMembershipHostId): EphemeraLudicTerminalId => {
        const portId = uuidv4()
        const port: EphemeraCrossingPort = { portId, fromHostId, ...portFieldsFrom(kindAndLabel) }
        steps.push({ kind: 'addCrossingPort', hostId, port })
        return { owner: hostId, port: portId }
    }

    // One hop at a time, source-to-ancestor order, minting this hop's port and pushing the leg
    // that references it immediately after (existing merge-order convention). `edgeFor` is the
    // one place the two sides diverge: ascending (subject), the known/running terminal stays
    // `subjectId` and the fresh port takes `targetId`; descending (target, walked in
    // `targetPath`'s own native nearest-target-first order), that's reversed --- mirroring the
    // original single-hop code's two blocks exactly, just generalized to any depth.
    const mintChain = (
        path: EphemeraMembershipHostId[],
        initialEntry: EphemeraLudicTerminalId,
        edgeFor: (port: EphemeraLudicTerminalId, running: EphemeraLudicTerminalId) => { subjectId: EphemeraLudicTerminalId; targetId: EphemeraLudicTerminalId }
    ): EphemeraLudicTerminalId =>
        path.slice(0, -1).reduce((entry, hostId, i) => {
            const port = mintPortAt(hostId, path[i + 1]!)
            steps.push({ kind: operationKind, ...edgeFor(port, entry), hostId, ...kindAndLabel })
            return port
        }, initialEntry)

    const subjectEntry = mintChain(subjectPath, subjectId, (port, running) => ({ subjectId: running, targetId: port }))
    const targetEntry = mintChain(targetPath, targetId, (port, running) => ({ subjectId: port, targetId: running }))

    // The chain's own designated relation, pushed last regardless of depth on either side:
    // connects the two sides' resulting terminals at their shared common ancestor.
    steps.push({ kind: operationKind, subjectId: subjectEntry, targetId: targetEntry, hostId: commonAncestor, ...kindAndLabel })

    return { verdict: 'built', steps }
}

/**
 * PV1-3b-13's remove-leg/remove-port step emitter, consuming `findRelationalChain`'s `'found'`
 * result --- the mirror of `buildCrossingLegs` above, but for dissolve: that function *mints*
 * fresh port ids and must place the port step before the leg that references it; this one only
 * removes ids that are already stored, so its two step kinds have no data dependency on each
 * other and the chain's own discovery order (outward from subject to target) is preserved as-is.
 *
 * Unlike `buildCrossingLegs`, this has no hop cap and no `notYetImplemented` case: the cap on the
 * establish side comes from `applyStepSequenceCore`'s host-resolution limits on a *freshly minted*
 * middle leg with no primitive endpoint, which doesn't apply here --- every id this function reads
 * off `steps` was already committed by some earlier `establishRelation` chain, however deep. It
 * inherits `findRelationalChain`'s own no-depth-cap decision (PV1-3b-11) for free.
 *
 * **Not wired into `expandSameHost.ts` by this row.** `expandSameHost`'s `dissolveRelation`
 * branch still calls `findShardBoundary` unconditionally regardless of `operationKind` --- rewiring
 * it onto `findRelationalChain`/this function is PV1-3b-14; building the commit path that would
 * actually execute the steps this emits is PV1-3b-3/16. This row is the standalone mapping and
 * its tests only.
 */
export const buildCrossingDissolveLegs = (steps: readonly RelationalChainStep[]): MutationKernelStep[] =>
    steps.map((step): MutationKernelStep =>
        step.type === 'edge'
            ? {
                kind: 'dissolveRelation',
                subjectId: step.edge.from,
                targetId: step.edge.to,
                hostId: step.hostId,
                ...relationKindAndLabelOf(step.edge),
            }
            : {
                kind: 'removeCrossingPort',
                hostId: step.hostId,
                portId: step.port.portId,
            }
    )
