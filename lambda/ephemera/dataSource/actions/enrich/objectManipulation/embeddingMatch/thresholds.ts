import { EMBEDDING_CALIBRATION_CORPUS_ID } from '../../../../../calibration/objectMatch/corpus'

export const EMBEDDING_MATCH_THRESHOLD_CORPUS_ID = EMBEDDING_CALIBRATION_CORPUS_ID

export const EMBEDDING_POOL_CALIBRATION_SNAPSHOT_ID = 'embedding-identity-pool-v1' as const

// -----------------------------------------------------------------------------
// v1 production shim (raw cosine) --- consumed by decideEmbeddingMatch until FT-2.
// Calibrated against embedding-identity-v1 on amazon.titan-embed-text-v2:0 at 2026-07-07.
// Live run: EmbeddingCalibrationCorpus (dev stack, calibratedAt 2026-07-07T16:13:34.148Z).
// Snapshot: calibration/objectMatch/snapshots/embedding-identity-v1-2026-07-07.json
// NOT pool admission floors --- terminal open-loop embedding resolve only.

/** Minimum cosine similarity for multi-candidate catalog. */
export const T_ABS = 0.14

/** Higher floor when exactly one eligible embedding exists (unary trap). Must stay > T_ABS (EM-D3). */
export const T_ABS_UNARY = 0.18

/** Minimum gap sim_best - sim_2nd when two or more eligible candidates (EM-D2: absolute gap). */
export const T_MARGIN = 0.008

// -----------------------------------------------------------------------------
// FT-8 per-signal relevance normalization (locked FT-1.3, 2026-07-09).
// Mocked identity corpus + short-span A/B; confirm on live Bedrock via pool snapshot.
// corpusId: embedding-identity-v1; modelId: amazon.titan-embed-text-v2:0
// Snapshot: calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09.json

/** Corpus noise floor for embedRelevance two-point log map. */
export const C_MIN = 0.05

/** Upper anchor for embedRelevance (exact normalized-shortName match). */
export const C_MAX = 1

/** Lexical proportional floor so ultra-short catalog names are not brittle. */
export const L_MIN = 5

/** Minimum normalized span length for FT-1.4 upstream junk-span discard (not pool lexical gating). */
export const S_MIN = 3

/** Flank edit cost when separated from match by non-alpha / token boundary. */
export const LEX_FLANK_STRONG_COST = 0.25

/** Flank edit cost when alpha-adjacent to match within same token. */
export const LEX_FLANK_MODERATE_COST = 0.5

/** In-window substitution / insertion unit cost (typo tolerance). */
export const LEX_MATCH_SUBSTITUTION_COST = 1

/** Max multiplicative discount for alpha-adjoined flank material (simulator A/B only). */
export const LEX_ADJOINED_FLANK_MAX_DAMAGE = 0.5

/** Max multiplicative discount for whitespace-/boundary-separated remote material (simulator A/B). */
export const LEX_REMOTE_FLANK_MAX_DAMAGE = 0.2

/** Decay rate for flank-length relevance vs match-span multiples (simulator A/B). */
export const LEX_FLANK_RELEVANCE_K = 1

// -----------------------------------------------------------------------------
// FT-1.3.2-1.3.6 lexical flank combine (locked 2026-07-09).
// Canonical snapshot: calibration/objectMatch/snapshots/embedding-identity-pool-v1-2026-07-09-bias-sweep.json
// Sweeps: testing/flankChannelWeightSweep.ts (FT-1.3.5), testing/flankCombineBiasSweep.ts (FT-1.3.6)
// FT-1.3.2: coverage-derived biasEff + adjoined positive damp (BIAS_MIN, BIAS_COVERAGE_SCALE, ADJOINED_POS_DAMP_SCALE)
// FT-1.3.3: ratio-invariant adjoined (ADJOINED_FLANK_MIDPOINT_RATIO)
// FT-1.3.4: ratio-invariant remote (REMOTE_FLANK_MIDPOINT_RATIO)
// FT-1.3.5: LEX_ADJOINED_FLANK_WEIGHT=3.0, LEX_REMOTE_FLANK_WEIGHT=0.4
// FT-1.3.6: LEX_FLANK_COMBINE_BIAS=1.5 (Pareto: highest biasMax with a/axe lex < T_JOINT_ABS)
// coverage = patternLength / candidateTextLength drives biasEff; production channels use x/spanScale when context present.

/** Outer sigmoid bias when all flank channels sit at their midpoints. */
export const LEX_FLANK_COMBINE_BIAS = 1.5

/** Steepness scale for adjoined left/right flank evidence channels. */
export const LEX_ADJOINED_FLANK_SCALE = 1.5

/** Weight for adjoined left/right flank evidence channels. */
export const LEX_ADJOINED_FLANK_WEIGHT = 3.0

/** Remote flank midpoint as a multiple of spanScale (wrapper length neutral point). Legacy absolute path. */
export const LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER = 3

/** FT-1.3.4: ratio-invariant remote midpoint (fraction of spanScale; neutral at 3x remote/span). */
export const LEX_REMOTE_FLANK_MIDPOINT_RATIO = LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER

/** Steepness scale for combined remote flank evidence channel. */
export const LEX_REMOTE_FLANK_SCALE = 4

/** Weight for combined remote flank evidence channel. */
export const LEX_REMOTE_FLANK_WEIGHT = 0.4

/** Outer sigmoid bias at zero embed coverage (fragment match). */
export const LEX_FLANK_COMBINE_BIAS_MIN = 0

/** Steepness of tanh lift on embed coverage for bias interpolation. */
export const LEX_BIAS_COVERAGE_SCALE = 4

/** Pattern-length scale for asymmetric adjoined positive evidence damp: tanh(patternLength / scale). */
export const LEX_ADJOINED_POS_DAMP_SCALE = 3

/** FT-1.3.3: ratio-invariant adjoined midpoint (fraction of spanScale; neutral flank ratio). */
export const LEX_ADJOINED_FLANK_MIDPOINT_RATIO = 0.5

// -----------------------------------------------------------------------------
// FT-1.2 pool merge (locked FT-1.3, 2026-07-09).

/** RMS weight for lexical channel in weightedRmsJointRelevance. */
export const JOINT_RELEVANCE_W_L = 1.0

/** RMS weight for embedding channel in weightedRmsJointRelevance. */
export const JOINT_RELEVANCE_W_E = 1.0

/** Hard ceiling on gap-trim shortlist length. */
export const POOL_SHORTLIST_TOP_N = 5

/** Relative drop (score_i - score_{i+1}) / score_i that ends shortlist inclusion. */
export const POOL_GAP_TRIM_RELATIVE_DROP = 0.15

// -----------------------------------------------------------------------------
// FT-5 selector (joint relevance scale) --- proposed, unwired until FT-5 ships.
// Fit from mocked identity corpus pool metrics (FT-1.3); live Bedrock headroom in pool snapshot.
// Consumes jointRelevance + marginToRunnerUp on [0,1] absolute scale --- NOT pool admission.

/** Minimum top-1 jointRelevance for auto-resolve (multi-candidate). */
export const T_JOINT_ABS = 0.42

/** Minimum jointRelevance gap top-1 vs top-2 for auto-resolve when |candidates| >= 2. */
export const T_JOINT_MARGIN = 0.08

/** Higher joint floor when exactly one catalog candidate (unary trap). Must stay > T_JOINT_ABS. */
export const T_JOINT_ABS_UNARY = 0.48

export type RelevanceNormalizationParams = {
    cMin?: number
    cMax?: number
    lMin?: number
    sMin?: number
    lexFlankStrongCost?: number
    lexFlankModerateCost?: number
    lexMatchSubstitutionCost?: number
    lexAdjoinedFlankMaxDamage?: number
    lexRemoteFlankMaxDamage?: number
    lexFlankRelevanceK?: number
    lexFlankCombineBias?: number
    lexFlankCombineBiasMin?: number
    lexBiasCoverageScale?: number
    lexAdjoinedPosDampScale?: number
    lexAdjoinedFlankMidpointRatio?: number
    lexAdjoinedFlankScale?: number
    lexAdjoinedFlankWeight?: number
    lexRemoteFlankMidpointMultiplier?: number
    lexRemoteFlankMidpointRatio?: number
    lexRemoteFlankScale?: number
    lexRemoteFlankWeight?: number
    jointRelevanceWL?: number
    jointRelevanceWE?: number
    poolShortlistTopN?: number
    poolGapTrimRelativeDrop?: number
}
