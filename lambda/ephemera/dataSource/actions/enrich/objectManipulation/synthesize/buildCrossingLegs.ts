import { v4 as uuidv4 } from 'uuid'

import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraLudicTerminalId, HostRelationalEdgeKind, RelationalKindAndLabel } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** A crossing leg's kind/label pairing, narrowed off `'Present'` (that kind is presence ports' own --- see `EphemeraCrossingPort`). */
type CrossingKindAndLabel = RelationalKindAndLabel<Exclude<HostRelationalEdgeKind, 'Present'>>

import type { MutationKernelStep } from '../../../../positions/manipulation/kernel/kernelStep'

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
 * inclusive of the common ancestor itself.
 *
 * Each crossing gets exactly one fresh `EphemeraCrossingPort`, minted here (the one place this
 * relation's edges gain identity for the first time) and stored on the **interior** side ---
 * whichever host is nearer the endpoint the relation is reaching toward, mirroring the readout's
 * own asymmetry (PV1-0: the table, not the room, holds the port record for the room/table
 * crossing). A leg living in a host's own graph either starts from that host's own freshly-minted
 * port (self-owned, when this leg is itself the interior side of a crossing) or from the real
 * endpoint (subject/target) directly, when there is no further hop to cross first.
 *
 * **A path length of 0 and of 1 mean the same thing here** -- "use the raw endpoint, mint no
 * port". Length 1 is "this endpoint sits directly in the common ancestor's graph"; length 0 is
 * "this endpoint *is* the common ancestor, and is its own graph's root node" (PV1-3b-8's
 * zero-hop ancestry, `findShardBoundary.ts`). Only length 2 mints a port, which is why both
 * blocks below test `=== 2` rather than branching on emptiness.
 *
 * **Scope cut, deliberate:** supports at most one extra hop per side (`subjectPath`/`targetPath`
 * length <= 2), and never both sides having an extra hop at once --- that combination needs a
 * *middle* leg between two port addresses with no primitive endpoint at all, which
 * `applyStepSequenceCore`'s host-resolution (PV1-3b-7 onward: an assertion against a carried
 * `hostId`, not a derive-from-endpoint-ids resolver) still cannot resolve a *middle* leg with no
 * primitive endpoint on either side --- there is no single host to carry there either. Reports
 * `notYetImplemented` for that case, the same shape `findShardBoundary` already uses for its own
 * unsupported (`ambiguous`) case, rather than emitting steps that would later throw at apply time.
 *
 * `operationKind` picks `establishRelation`/`dissolveRelation` for the final step (PV1-3b-4 ---
 * the collapsed ingress seed no longer carries a sibling relational step of its own, so this
 * function is now the only source of that step for every same-host candidate, dissolves
 * included, not just the crossing ones). **Dissolving an actual crossing stays unbuilt and
 * reports `notYetImplemented`**: a real crossing (either path length `=== 2`) would also need to
 * *remove* the crossing port(s) it once minted, which this function only ever adds --- left for
 * whichever slice needs it. Only the no-port (portless leg) degenerate case supports dissolve
 * today.
 *
 * **`hostId` (PV1-3b-7):** each hop leg carries `nearHost` (the same host its own freshly-minted
 * port is added to); the final chain step carries `commonAncestor` (both its entries, primitive or
 * port address, are referenced from that host's own graph once any crossing is placed).
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

    if (subjectPath.length > 2 || targetPath.length > 2) {
        return { verdict: 'notYetImplemented', reason: 'buildCrossingLegs: chains deeper than one extra hop per side are not yet supported' }
    }
    if (subjectPath.length === 2 && targetPath.length === 2) {
        return {
            verdict: 'notYetImplemented',
            reason: 'buildCrossingLegs: a middle leg with two port-address endpoints (both sides one extra hop deep) is not yet supported',
        }
    }
    if (operationKind === 'dissolveRelation' && (subjectPath.length === 2 || targetPath.length === 2)) {
        return {
            verdict: 'notYetImplemented',
            reason: 'buildCrossingLegs: dissolving a relation that crosses a real shard boundary is not yet supported --- it would also need to remove the crossing port(s) this function only ever adds',
        }
    }

    const steps: MutationKernelStep[] = []

    let subjectEntry: EphemeraLudicTerminalId = subjectId
    if (subjectPath.length === 2) {
        const [nearHost] = subjectPath
        const portId = uuidv4()
        const port: EphemeraCrossingPort = { portId, fromHostId: commonAncestor, ...portFieldsFrom(kindAndLabel) }
        steps.push({ kind: 'addCrossingPort', hostId: nearHost, port })
        subjectEntry = { owner: nearHost, port: portId }
        steps.push({ kind: 'establishRelation', subjectId, targetId: subjectEntry, hostId: nearHost, ...kindAndLabel })
    }

    let targetEntry: EphemeraLudicTerminalId = targetId
    if (targetPath.length === 2) {
        const [nearHost] = targetPath
        const portId = uuidv4()
        const port: EphemeraCrossingPort = { portId, fromHostId: commonAncestor, ...portFieldsFrom(kindAndLabel) }
        steps.push({ kind: 'addCrossingPort', hostId: nearHost, port })
        targetEntry = { owner: nearHost, port: portId }
        steps.push({ kind: 'establishRelation', subjectId: targetEntry, targetId, hostId: nearHost, ...kindAndLabel })
    }

    steps.push({ kind: operationKind, subjectId: subjectEntry, targetId: targetEntry, hostId: commonAncestor, ...kindAndLabel })

    return { verdict: 'built', steps }
}
