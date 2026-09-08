import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { HostRelationalEdge } from '../../ludicGraph/baseClasses'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { MutationKernelStep } from './kernelStep'

export type StepSequenceFootprint = ReadonlySet<EphemeraMembershipHostId>

/**
 * A capture step's output: rosters snapshotted mid-walk, keyed by the caller-assigned
 * `captureId`. Plain arrays, never the live `EphemeraLudicGraph`-backed `Set` --- these values
 * are handed out past the `MultiKeyUpdate` reducer boundary, and, once a narration branch
 * consumes them (Phase 2), past the transaction entirely.
 */
export type MutationKernelCaptures = ReadonlyMap<string, readonly EphemeraCharacterId[]>

/**
 * What a `repairable` verdict names: the change to make before re-proposing. One member today ---
 * emit the `DissolveRelationStep` that should have preceded the transfer. The point of carrying it
 * as a value is that a caller can *apply* it rather than parse a reason code to re-derive it.
 */
export type MutationKernelRepair =
    | { kind: 'dissolveRelationalEdge'; hostId: EphemeraMembershipHostId; edge: HostRelationalEdge }

/**
 * BD-27c's shared apply-core result. Legitimate legality outcomes return through this discriminated
 * union, matching `applyTransferSet`'s convention. Structural-invariant violations (BD-33 relational
 * host mismatch; `RelationalEdgeStillReferencedError`) are *not* a verdict here --- they throw,
 * uniformly in both modes (dry-run and commit), per the design doc's "Throw vs. verdict" decision.
 * `captures` rides alongside `graphs` on the `legal` verdict only --- any non-`legal` outcome
 * discards whatever was captured so far, since nothing commits.
 *
 * **The non-`legal` arms partition by what a caller can do next, not by severity.** This replaced
 * `illegal | defer(decidable)` on 2026-09-08, which asked a single-shot question ("may this
 * proceed?") that no caller asks any more:
 *
 * - `repairable` --- a change to the proposed plan would make this legal, and `repair` says which.
 *   `authority` records *how visible* applying it would be: `mechanical` is invisible to the player
 *   (severing an already-dissolving edge), `worldChanging` is not (moving the lamp that was resting
 *   on the book). Recorded, deliberately not acted on: whether a `worldChanging` repair may be
 *   applied silently or must escalate to the player is a world-model question, and naming the axis
 *   here is what keeps a repair policy written as an answer to it rather than by accident.
 * - `stale` --- the plan may well be fine; the snapshot it was checked against is not. Re-fetch and
 *   re-check, do not repair and do not discard. `exponentialBackoffWrapper` already absorbs these at
 *   commit time, one layer below where this verdict is visible.
 * - `irreparable` --- no repair is known *at this layer*. Today that is a `Custom` interaction edge
 *   (classifying it would need an LLM validator) and a caller bug (a Room/Feature id in a transfer).
 *
 * Every arm keeps `reasonCode`, so a caller that only needs "did it pass?" stays a one-line check.
 */
export type MutationKernelApplyOutcome =
    | { verdict: 'legal'; graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>; captures: MutationKernelCaptures }
    | { verdict: 'repairable'; reasonCode: string; repair: MutationKernelRepair; authority: 'mechanical' | 'worldChanging' }
    | { verdict: 'stale'; reasonCode: string }
    // `edge` is optional because not every irreparable outcome is *about* an edge --- a
    // Room/Feature id in a transfer is a caller bug with no edge to name. When there is one, it is
    // carried: "which relation could I not decide" is the whole of the `why`, and it is what a
    // later escalation feature (asking the player about the `tied to` relation) would have to ask
    // about.
    | { verdict: 'irreparable'; reasonCode: string; edge?: HostRelationalEdge }

export type MutationKernelCommitResult =
    | { ok: true; beatAnchorTime: number; steps: readonly MutationKernelStep[]; captures: MutationKernelCaptures }
    | { ok: false; errorCode: string; errorMessage: string }
