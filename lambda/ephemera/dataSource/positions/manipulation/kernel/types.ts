import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../positionGraph'
import type { KernelStep } from './kernelStep'

export type StepSequenceFootprint = ReadonlySet<EphemeraMembershipHostId>

/**
 * BD-27c's shared apply-core result. Legitimate legality outcomes (stale candidate, `Custom`-edge
 * defer) return through this discriminated union, matching `applyTransferSet`'s existing
 * convention. Structural-invariant violations (BD-33 relational host mismatch;
 * `RelationalEdgeStillReferencedError`) are *not* a verdict here --- they throw, uniformly in both
 * modes (dry-run and commit), per the design doc's "Throw vs. verdict" decision.
 */
export type KernelApplyOutcome =
    | { verdict: 'legal'; graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph> }
    | { verdict: 'illegal'; reasonCode: string }
    | { verdict: 'defer'; decidable: boolean; reasonCode: string }

export type KernelCommitResult =
    | { ok: true; beatAnchorTime: number; steps: readonly KernelStep[] }
    | { ok: false; errorCode: string; errorMessage: string }
