import { EMBEDDING_CALIBRATION_CORPUS_ID } from '../../../../../calibration/objectMatch/corpus'

export const EMBEDDING_MATCH_THRESHOLD_CORPUS_ID = EMBEDDING_CALIBRATION_CORPUS_ID

// Calibrated against embedding-identity-v1 on amazon.titan-embed-text-v2:0 at 2026-07-07.
// Live run: EmbeddingCalibrationCorpus (dev stack, calibratedAt 2026-07-07T16:13:34.148Z).
// Titan v2 quantized cosines on short object phrases sit ~0.05-0.25 (not ~0.85+).
// EM-D2: absolute gap (T_MARGIN); ratio rejected -- similar separation, absolute already shipped.
// Absent-object (identity-001) best sim 0.253 exceeds paraphrase best 0.158; margin gate
// (0.0075 vs 0.075) separates them when T_ABS <= 0.158.

/** Minimum cosine similarity for multi-candidate catalog. */
export const T_ABS = 0.14

/** Higher floor when exactly one eligible embedding exists (unary trap). Must stay > T_ABS (EM-D3). */
export const T_ABS_UNARY = 0.18

/** Minimum gap sim_best - sim_2nd when two or more eligible candidates (EM-D2: absolute gap). */
export const T_MARGIN = 0.008

// FT-1.1 / FT-8 relevance normalization (first effort; lock in FT-1.3 calibration pass).
// Absolute scale discipline: fixed global anchors, never within-candidate-set rescale.

/** Corpus noise floor for embedRelevance two-point log map. */
export const C_MIN = 0.05

/** Upper anchor for embedRelevance (exact normalized-shortName match). */
export const C_MAX = 1

/** Lexical proportional floor so ultra-short catalog names are not brittle. */
export const L_MIN = 5

/** Short-span admissibility threshold (normalized span length). */
export const S_MIN = 3

/** Flank edit cost when separated from match by non-alpha / token boundary. */
export const LEX_FLANK_STRONG_COST = 0.25

/** Flank edit cost when alpha-adjacent to match within same token. */
export const LEX_FLANK_MODERATE_COST = 0.5

/** In-window substitution / insertion unit cost (typo tolerance). */
export const LEX_MATCH_SUBSTITUTION_COST = 1

/** Max multiplicative discount for alpha-adjoined flank material (per flank factor). */
export const LEX_ADJOINED_FLANK_MAX_DAMAGE = 0.5

/** Max multiplicative discount for whitespace-/boundary-separated remote material. */
export const LEX_REMOTE_FLANK_MAX_DAMAGE = 0.2

/** Decay rate for flank-length relevance vs match-span multiples (calibration-owned). */
export const LEX_FLANK_RELEVANCE_K = 1

// FT-1.1.5 tanh-centered flank combine (provisional; lock in FT-1.3 calibration pass).
// sigmoid(bias + e_L + e_R + e_Rm) where e_i = w_i * tanh((m_i - x_i) / s_i).
// Adjoined midpoint m = spanScale / 2 at runtime; remote midpoint = spanScale * LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER.

/** Outer sigmoid bias when all flank channels sit at their midpoints. */
export const LEX_FLANK_COMBINE_BIAS = 2.6

/** Steepness scale for adjoined left/right flank evidence channels. */
export const LEX_ADJOINED_FLANK_SCALE = 1.5

/** Weight for adjoined left/right flank evidence channels. */
export const LEX_ADJOINED_FLANK_WEIGHT = 1.0

/** Remote flank midpoint as a multiple of spanScale (wrapper length neutral point). */
export const LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER = 3

/** Steepness scale for combined remote flank evidence channel. */
export const LEX_REMOTE_FLANK_SCALE = 4

/** Weight for combined remote flank evidence channel. */
export const LEX_REMOTE_FLANK_WEIGHT = 0.9

// FT-1.2 pool merge (provisional; lock in FT-1.3 calibration pass).

/** RMS weight for lexical channel in weightedRmsJointRelevance. */
export const JOINT_RELEVANCE_W_L = 1.0

/** RMS weight for embedding channel in weightedRmsJointRelevance. */
export const JOINT_RELEVANCE_W_E = 1.0

/** Hard ceiling on gap-trim shortlist length. */
export const POOL_SHORTLIST_TOP_N = 5

/** Relative drop (score_i - score_{i+1}) / score_i that ends shortlist inclusion. */
export const POOL_GAP_TRIM_RELATIVE_DROP = 0.15

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
    lexAdjoinedFlankScale?: number
    lexAdjoinedFlankWeight?: number
    lexRemoteFlankMidpointMultiplier?: number
    lexRemoteFlankScale?: number
    lexRemoteFlankWeight?: number
    jointRelevanceWL?: number
    jointRelevanceWE?: number
    poolShortlistTopN?: number
    poolGapTrimRelativeDrop?: number
}
