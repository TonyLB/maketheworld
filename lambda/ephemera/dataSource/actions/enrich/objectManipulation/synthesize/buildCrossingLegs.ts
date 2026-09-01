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
 * **Scope cut, deliberate:** supports at most one extra hop per side (`subjectPath`/`targetPath`
 * length <= 2), and never both sides having an extra hop at once --- that combination needs a
 * *middle* leg between two port addresses with no primitive endpoint at all, which
 * `applyStepSequenceCore`'s host-resolution (derive-from-endpoint-ids, BD-33) cannot resolve
 * without carrying an explicit host on the step, a bigger change this slice does not make. Reports
 * `notYetImplemented` for that case, the same shape `findShardBoundary` already uses for its own
 * unsupported (`ambiguous`) case, rather than emitting steps that would later throw at apply time.
 * Establish-only: PV1-3's readout only exercises `tie` (an establish), not the dissolve/untie
 * direction --- building dissolve legs (which would also need to *remove* the crossing ports) is
 * left for whichever slice needs it.
 */
export const buildCrossingLegs = (
    input: {
        subjectId: EphemeraPositionAdjacencyContainedId
        targetId: EphemeraPositionAdjacencyContainedId
        commonAncestor: EphemeraMembershipHostId
        subjectPath: EphemeraMembershipHostId[]
        targetPath: EphemeraMembershipHostId[]
    } & CrossingKindAndLabel
): BuildCrossingLegsResult => {
    const { subjectId, targetId, commonAncestor, subjectPath, targetPath } = input
    const kindAndLabel: CrossingKindAndLabel = input.relationKind === 'Custom'
        ? { relationKind: 'Custom', relationLabel: input.relationLabel }
        : { relationKind: input.relationKind }

    if (subjectPath.length === 0 || targetPath.length === 0) {
        return { verdict: 'notYetImplemented', reason: 'buildCrossingLegs: a zero-hop ancestry (endpoint is itself the common ancestor) is not yet supported' }
    }
    if (subjectPath.length > 2 || targetPath.length > 2) {
        return { verdict: 'notYetImplemented', reason: 'buildCrossingLegs: chains deeper than one extra hop per side are not yet supported' }
    }
    if (subjectPath.length === 2 && targetPath.length === 2) {
        return {
            verdict: 'notYetImplemented',
            reason: 'buildCrossingLegs: a middle leg with two port-address endpoints (both sides one extra hop deep) is not yet supported',
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
        steps.push({ kind: 'establishRelation', subjectId, targetId: subjectEntry, ...kindAndLabel })
    }

    let targetEntry: EphemeraLudicTerminalId = targetId
    if (targetPath.length === 2) {
        const [nearHost] = targetPath
        const portId = uuidv4()
        const port: EphemeraCrossingPort = { portId, fromHostId: commonAncestor, ...portFieldsFrom(kindAndLabel) }
        steps.push({ kind: 'addCrossingPort', hostId: nearHost, port })
        targetEntry = { owner: nearHost, port: portId }
        steps.push({ kind: 'establishRelation', subjectId: targetEntry, targetId, ...kindAndLabel })
    }

    steps.push({ kind: 'establishRelation', subjectId: subjectEntry, targetId: targetEntry, ...kindAndLabel })

    return { verdict: 'built', steps }
}
