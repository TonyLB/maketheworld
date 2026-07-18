/**
 * Placeholder combiner for two already-[0,1] confidence scores (e.g. identity
 * shortlist confidence x plan-fallback LLM confidence). Deliberately naive —
 * arithmetic mean, no calibration. Superseded by BD-19 (3)'s logit-sum-sigmoid
 * design once the plan-LLM fallback exists and produces real calibration data
 * (AGENT.manipulationFrameAndRelational.planning.md, BD-19).
 */
export const combineConfidenceNaive = (a: number, b: number): number => (a + b) / 2
