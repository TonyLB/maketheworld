import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type {
    ExecutorDissolveRelationStep,
    ExecutorEstablishRelationStep,
    ExecutorParsePlanStep,
} from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'

/**
 * BD-27c/BD-36's kernel-layer step vocabulary --- a deliberately narrow superset of the Synthesize
 * executor's `ExecutorParsePlanStep`. The transfer case widens twice: `entityIds` admits both
 * `EphemeraObjectId` and `EphemeraCharacterId`, since the kernel's membership transfer generalizes
 * over entity kind (BD-36), while the Synthesize executor's own `TransferMembershipStep` stays
 * object-only and unwidened (it only ever grounds objects --- character movement never goes through
 * Grounding/Expansion/Validation at all, so there is no ambiguity for it to resolve). And (object-
 * lifecycle Migrate row) `fromHostIds`/`toHostId` widen from a singular non-null pair to a plural
 * `froms` set + nullable `to`, mirroring `MembershipDiff`'s existing `{froms: HostId[], to: HostId |
 * null}` shape exactly --- this is what lets one step kind cover a real transfer (both populated,
 * the only shape the two player routes ever produce), a pure add (`fromHostIds` empty --- spawn),
 * and a pure remove (`toHostId` null --- destroy/clear, a stray-room scrub with no consolidation
 * target). Relational steps are reused verbatim from the executor's types: relational edges stay
 * `EphemeraObjectId`-typed this iteration (BD-36's character-relation widening is explicitly
 * deferred), so there is nothing to generalize there.
 */
export type KernelTransferMembershipStep = {
    kind: 'transferMembership'
    entityIds: ReadonlySet<EphemeraObjectId | EphemeraCharacterId>
    fromHostIds: ReadonlySet<EphemeraMembershipHostId>
    toHostId: EphemeraMembershipHostId | null
}

export type KernelStep = KernelTransferMembershipStep | ExecutorEstablishRelationStep | ExecutorDissolveRelationStep

/**
 * Adapter from the executor's shipped output shape to the kernel's own step vocabulary. The
 * executor's `TransferMembershipStep` always carries exactly one non-null `fromHostId`/`toHostId`
 * (a real player-command transfer), so this just wraps `fromHostId` in a one-element set --- the
 * object-lifecycle routes' pure-add/pure-remove/multi-host shapes are constructed directly as
 * `KernelTransferMembershipStep` literals, not through this adapter, since they never go through the
 * Synthesize executor at all.
 */
export const fromExecutorStep = (step: ExecutorParsePlanStep): KernelStep =>
    step.kind === 'transferMembership'
        ? {
            kind: 'transferMembership',
            entityIds: step.objectIds,
            fromHostIds: new Set([step.fromHostId]),
            toHostId: step.toHostId,
        }
        : step
