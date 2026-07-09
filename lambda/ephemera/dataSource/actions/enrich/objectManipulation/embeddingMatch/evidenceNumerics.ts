/**
 * Domain-agnostic numeric primitives for evidence combiners.
 * No FT-1 semantics; lift to internalUtils only if a non-embeddingMatch consumer appears.
 */

const SIGMOID_CLAMP = 20

export const sigmoid = (x: number): number => {
    if (!Number.isFinite(x)) {
        return x > 0 ? 1 : 0
    }
    const clamped = Math.max(-SIGMOID_CLAMP, Math.min(SIGMOID_CLAMP, x))
    return 1 / (1 + Math.exp(-clamped))
}

export const tanh = (x: number): number => Math.tanh(x)

export const clampUnitInterval = (x: number): number => Math.min(1, Math.max(0, x))
