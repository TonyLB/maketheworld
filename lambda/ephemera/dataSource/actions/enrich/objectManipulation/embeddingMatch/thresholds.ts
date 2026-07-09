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

export type RelevanceNormalizationParams = {
    cMin?: number
    cMax?: number
    lMin?: number
    sMin?: number
    lexFlankStrongCost?: number
    lexFlankModerateCost?: number
    lexMatchSubstitutionCost?: number
}
