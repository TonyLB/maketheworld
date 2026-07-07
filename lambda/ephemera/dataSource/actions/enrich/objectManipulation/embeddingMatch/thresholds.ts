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
