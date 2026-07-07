import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'
import type { EmbeddingCalibrationIdentityCase } from '../../../../../../calibration/objectMatch/corpus'
import type { EmbeddingMatchCandidate } from '../types'

export const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const zeroVector = (): number[] =>
    Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)

export const unitVectorAlongAxis = (axis: number, sign: 1 | -1 = 1): number[] => {
    const values = zeroVector()
    values[axis] = sign
    return values
}

export const makeEmbeddingFromAxis = (axis: number, sign: 1 | -1 = 1): SemanticEmbedding =>
    SemanticEmbedding.fromFloat32(unitVectorAlongAxis(axis, sign), { modelId: TEST_MODEL_ID })

const resolveReferenceAxis = (reference: SemanticEmbedding): number => {
    for (let axis = 0; axis < SEMANTIC_EMBEDDING_V1_DIMENSIONS; axis++) {
        if (reference.cosineSimilarity(makeEmbeddingFromAxis(axis)) > 0.99) {
            return axis
        }
    }
    throw new Error('embeddingAtCosineSimilarity: reference is not a unit axis vector')
}

/**
 * Unit vector with cosine similarity `targetSimilarity` to `reference` (unit axis vectors only).
 */
export const embeddingAtCosineSimilarity = (
    reference: SemanticEmbedding,
    targetSimilarity: number
): SemanticEmbedding => {
    const referenceAxis = resolveReferenceAxis(reference)
    const orthAxis = referenceAxis === 0 ? 1 : 0
    const refAxis = unitVectorAlongAxis(referenceAxis)
    const orthAxisValues = unitVectorAlongAxis(orthAxis)
    const clamped = Math.max(-1, Math.min(1, targetSimilarity))
    const orthWeight = Math.sqrt(Math.max(0, 1 - clamped * clamped))
    const values = zeroVector()
    for (let i = 0; i < values.length; i++) {
        values[i] = refAxis[i] * clamped + orthAxisValues[i] * orthWeight
    }
    const embedding = SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })
    const actual = reference.cosineSimilarity(embedding)
    if (Math.abs(actual - clamped) > 0.05) {
        throw new Error(
            `embeddingAtCosineSimilarity: expected ~${clamped}, got ${actual} after quantization`
        )
    }
    return embedding
}

export type IdentityCaseVectorPlan =
    | { kind: 'orthogonal-to-catalog' }
    | { kind: 'unary-below-floor'; similarity: number }
    | { kind: 'resolve-index'; targetIndex: number; targetSimilarity: number; otherSimilarity: number }
    | { kind: 'duplicate-shortname' }
    | { kind: 'below-multi-floor'; similarities: readonly number[] }

export const buildCandidatesFromIdentityCase = (
    identityCase: EmbeddingCalibrationIdentityCase,
    vectorPlan: IdentityCaseVectorPlan
): {
    spanEmbedding: SemanticEmbedding
    candidates: EmbeddingMatchCandidate[]
} => {
    const candidates: EmbeddingMatchCandidate[] = identityCase.catalog.map((shortName, index) => ({
        objectId: `OBJECT#cal-${identityCase.id}-${index}` as EphemeraObjectId,
        normalizedShortName: normalizeShortNameForEmbedding(shortName),
        catalogScope: 'room' as const,
        embedding: makeEmbeddingFromAxis(index + 1),
    }))

    let spanEmbedding: SemanticEmbedding
    const baseEmbedding = makeEmbeddingFromAxis(0)

    switch (vectorPlan.kind) {
        case 'orthogonal-to-catalog': {
            spanEmbedding = makeEmbeddingFromAxis(0)
            break
        }
        case 'unary-below-floor': {
            candidates[0] = { ...candidates[0]!, embedding: baseEmbedding }
            spanEmbedding = embeddingAtCosineSimilarity(baseEmbedding, vectorPlan.similarity)
            break
        }
        case 'resolve-index': {
            candidates[vectorPlan.targetIndex] = {
                ...candidates[vectorPlan.targetIndex]!,
                embedding: baseEmbedding,
            }
            spanEmbedding = embeddingAtCosineSimilarity(baseEmbedding, vectorPlan.targetSimilarity)
            for (let i = 0; i < candidates.length; i++) {
                if (i === vectorPlan.targetIndex) {
                    continue
                }
                // Axes >= 2 stay orthogonal to the span (confined to axes 0-1).
                candidates[i] = {
                    ...candidates[i]!,
                    embedding: makeEmbeddingFromAxis(i + 2),
                }
            }
            break
        }
        case 'duplicate-shortname': {
            candidates[0] = { ...candidates[0]!, embedding: baseEmbedding }
            candidates[1] = { ...candidates[1]!, embedding: baseEmbedding }
            spanEmbedding = embeddingAtCosineSimilarity(baseEmbedding, 0.99)
            break
        }
        case 'below-multi-floor': {
            spanEmbedding = baseEmbedding
            for (let i = 0; i < candidates.length; i++) {
                candidates[i] = {
                    ...candidates[i]!,
                    embedding: embeddingAtCosineSimilarity(
                        spanEmbedding,
                        vectorPlan.similarities[i] ?? 0
                    ),
                }
            }
            break
        }
        default: {
            const _exhaustive: never = vectorPlan
            throw new Error(`Unhandled vector plan: ${JSON.stringify(_exhaustive)}`)
        }
    }

    return { spanEmbedding, candidates }
}
