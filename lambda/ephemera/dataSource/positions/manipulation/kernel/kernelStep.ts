import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type {
    ExecutorDissolveRelationStep,
    ExecutorEstablishRelationStep,
    ExecutorParsePlanStep,
} from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'

/**
 * BD-27c/BD-36's kernel-layer step vocabulary --- a deliberately narrow superset of the Synthesize
 * executor's `ExecutorParsePlanStep`. Only the transfer case widens: `entityIds` admits both
 * `EphemeraObjectId` and `EphemeraCharacterId`, since the kernel's membership transfer generalizes
 * over entity kind (BD-36), while the Synthesize executor's own `TransferMembershipStep` stays
 * object-only and unwidened (it only ever grounds objects --- character movement never goes through
 * Grounding/Expansion/Validation at all, so there is no ambiguity for it to resolve). Relational
 * steps are reused verbatim from the executor's types: relational edges stay `EphemeraObjectId`-typed
 * this iteration (BD-36's character-relation widening is explicitly deferred), so there is nothing
 * to generalize there.
 */
export type KernelTransferMembershipStep = {
    kind: 'transferMembership'
    entityIds: ReadonlySet<EphemeraObjectId | EphemeraCharacterId>
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
}

export type KernelStep = KernelTransferMembershipStep | ExecutorEstablishRelationStep | ExecutorDissolveRelationStep

/**
 * Trivial, obviously-correct adapter from the executor's shipped output shape to the kernel's own
 * step vocabulary --- for the *next* Migrate row's use (wiring the two player-command routes onto
 * this kernel), not this slice. Does not touch the already-shipped executor types.
 */
export const fromExecutorStep = (step: ExecutorParsePlanStep): KernelStep =>
    step.kind === 'transferMembership'
        ? { kind: 'transferMembership', entityIds: step.objectIds, fromHostId: step.fromHostId, toHostId: step.toHostId }
        : step
