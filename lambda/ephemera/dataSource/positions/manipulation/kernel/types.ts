import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../positionGraph'
import type { MutationKernelStep } from './kernelStep'

export type StepSequenceFootprint = ReadonlySet<EphemeraMembershipHostId>

/**
 * A capture step's (PB-J) output: rosters snapshotted mid-walk, keyed by the caller-assigned
 * `captureId`. Plain arrays, never the live `EphemeraPositionGraph`-backed `Set` --- these values
 * are handed out past the `MultiKeyUpdate` reducer boundary (PB-E), and, once a narration branch
 * consumes them (Phase 2), past the transaction entirely.
 */
export type MutationKernelCaptures = ReadonlyMap<string, readonly EphemeraCharacterId[]>

/**
 * BD-27c's shared apply-core result. Legitimate legality outcomes (stale candidate, `Custom`-edge
 * defer) return through this discriminated union, matching `applyTransferSet`'s existing
 * convention. Structural-invariant violations (BD-33 relational host mismatch;
 * `RelationalEdgeStillReferencedError`) are *not* a verdict here --- they throw, uniformly in both
 * modes (dry-run and commit), per the design doc's "Throw vs. verdict" decision. `captures` (PB-J)
 * rides alongside `graphs` on the `legal` verdict only --- an illegal/defer outcome discards whatever
 * was captured so far, since nothing commits.
 */
export type MutationKernelApplyOutcome =
    | { verdict: 'legal'; graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraPositionGraph>; captures: MutationKernelCaptures }
    | { verdict: 'illegal'; reasonCode: string }
    | { verdict: 'defer'; decidable: boolean; reasonCode: string }

export type MutationKernelCommitResult =
    | { ok: true; beatAnchorTime: number; steps: readonly MutationKernelStep[]; captures: MutationKernelCaptures }
    | { ok: false; errorCode: string; errorMessage: string }
