import { EMBEDDING_CALIBRATION_CORPUS_ID } from '../../../../../calibration/objectMatch/corpus'

// Placeholder until EM-4 calibration; corpus: EMBEDDING_CALIBRATION_CORPUS_ID
// EM-D2 may replace T_MARGIN with R_MARGIN (ratio rule) after live calibration.
export const EMBEDDING_MATCH_THRESHOLD_CORPUS_ID = EMBEDDING_CALIBRATION_CORPUS_ID

/** Minimum cosine similarity for multi-candidate catalog (absent-object guard). */
export const T_ABS = 0.85

/** Higher floor when exactly one eligible embedding exists (unary trap). Must stay > T_ABS (EM-D3). */
export const T_ABS_UNARY = 0.92

/** Minimum gap sim_best - sim_2nd when two or more eligible candidates (EM-D2 may swap for ratio). */
export const T_MARGIN = 0.08
