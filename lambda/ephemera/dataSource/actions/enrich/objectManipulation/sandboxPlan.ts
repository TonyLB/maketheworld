import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { IdentityPlanCandidate, RelationalIdentityPlanCandidate } from './identityPlanCandidate'
import type { SandboxState } from './sandboxState'
import {
    applyRelationalStep,
    applyTransferMembershipStep,
    type SandboxStepOutcome,
    type TransferMembershipStepContext,
} from './sandboxStep'

/**
 * Sandbox-internal step representation for compound-plan evaluation. This is
 * scaffolding for exercising `sandboxStep.ts`'s per-step functions in
 * sequence --- it is **not** the Plan IR (`ParsePlanStep` union, parent
 * plan's C1). When C1 lands, it either reuses this shape or adapts its real
 * Plan IR into it.
 */
export type SandboxPlanStep =
    | {
        kind: 'transferMembership'
        candidate: IdentityPlanCandidate
        transferSet: ReadonlySet<EphemeraObjectId>
        context: TransferMembershipStepContext
    }
    | {
        kind: 'relational'
        candidate: RelationalIdentityPlanCandidate
        hostId: EphemeraMembershipHostId
    }

/**
 * Fold N single-step transitions, threading the resulting `SandboxState`
 * forward so step k+1 is evaluated against the mutated state step k
 * produced. BD-9: any non-`legal` step aborts evaluation immediately and is
 * returned as-is --- since `illegal`/`defer` outcomes carry no `state` field,
 * no partial-legal state can leak out of an aborted plan.
 */
export function evaluateSandboxPlan(
    initialState: SandboxState,
    steps: readonly SandboxPlanStep[]
): SandboxStepOutcome {
    return steps.reduce<SandboxStepOutcome>((outcome, step) => {
        if (outcome.verdict !== 'legal') {
            return outcome
        }
        return step.kind === 'transferMembership'
            ? applyTransferMembershipStep(outcome.state, step.candidate, step.transferSet, step.context)
            : applyRelationalStep(outcome.state, step.candidate, step.hostId)
    }, { verdict: 'legal', decidable: true, state: initialState })
}
