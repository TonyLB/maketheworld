import type { InvokeBedrockTitanEmbedResult } from '../../llm/invokeBedrockTitanEmbed'
import { SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import { runSemanticDistanceLadder } from './runSemanticDistanceLadder'
import {
    SEMANTIC_DISTANCE_LADDER_PAIRS,
    SEMANTIC_DISTANCE_TIER_ORDER,
} from './semanticDistanceLadder'

const embeddingByNormalized = new Map<string, number[]>()

const makeEmbedding = (seed: number): number[] =>
    Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, index) =>
        index === 0 ? seed : index * 0.0001
    )

const mockInvokeEmbed = jest.fn(async ({ inputText }: { inputText: string }) => {
    const normalized = normalizeShortNameForEmbedding(inputText)
    let vector = embeddingByNormalized.get(normalized)
    if (!vector) {
        vector = makeEmbedding(embeddingByNormalized.size * 0.1 + 0.5)
        vector = [...vector]
        vector[0] = embeddingByNormalized.size * 0.08
        embeddingByNormalized.set(normalized, vector)
    }
    return {
        success: true,
        embedding: vector,
    } satisfies InvokeBedrockTitanEmbedResult
})

describe('semanticDistanceLadder corpus', () => {
    it('uses unique ids and valid tiers', () => {
        const ids = SEMANTIC_DISTANCE_LADDER_PAIRS.map(({ id }) => id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const pair of SEMANTIC_DISTANCE_LADDER_PAIRS) {
            expect(SEMANTIC_DISTANCE_TIER_ORDER).toContain(pair.tier)
            expect(pair.left.trim().length).toBeGreaterThan(0)
            expect(pair.right.trim().length).toBeGreaterThan(0)
        }
    })
})

describe('runSemanticDistanceLadder', () => {
    beforeEach(() => {
        embeddingByNormalized.clear()
        mockInvokeEmbed.mockClear()
    })

    const deps = { invokeEmbed: mockInvokeEmbed }

    it('returns cases sorted by similarity descending', async () => {
        const result = await runSemanticDistanceLadder(undefined, deps)
        expect(result.cases.length).toBe(SEMANTIC_DISTANCE_LADDER_PAIRS.length)
        const sorted = result.sortedBySimilarity.map((entry) => entry.similarity)
        expect(sorted).toEqual([...sorted].sort((left, right) => right - left))
    })

    it('includes tier summaries for each tier', async () => {
        const result = await runSemanticDistanceLadder(undefined, deps)
        expect(result.tierSummaries.length).toBe(SEMANTIC_DISTANCE_TIER_ORDER.length)
        for (const summary of result.tierSummaries) {
            expect(summary.count).toBeGreaterThan(0)
            expect(summary.tierOrderIndex).toBeGreaterThanOrEqual(0)
        }
    })

    it('filters by tier when requested', async () => {
        const result = await runSemanticDistanceLadder('inflection', deps)
        expect(result.cases.every((entry) => entry.tier === 'inflection')).toBe(true)
        expect(result.cases.length).toBe(2)
    })
})
