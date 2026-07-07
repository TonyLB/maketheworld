import type { InvokeBedrockTitanEmbedResult } from '../../llm/invokeBedrockTitanEmbed'
import { SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import {
    ASYMMETRIC_IDENTITY_LADDER_CASES,
    ASYMMETRIC_IDENTITY_TIER_ORDER,
    buildCatalogIndexText,
    normalizeCatalogIndexTextForEmbedding,
} from './asymmetricIdentityLadder'
import { runAsymmetricIdentityLadder } from './runAsymmetricIdentityLadder'

const spanEmbeddingByNormalized = new Map<string, number[]>()
const catalogEmbeddingByText = new Map<string, number[]>()

const makeEmbedding = (seed: number): number[] =>
    Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, index) =>
        index === 0 ? seed : index * 0.0001
    )

const mockInvokeEmbed = jest.fn(async ({ inputText }: { inputText: string }) => {
    const spanNormalized = normalizeShortNameForEmbedding(inputText)
    const catalogNormalized = normalizeCatalogIndexTextForEmbedding(inputText)

    if (spanNormalized.length > 0 && spanNormalized === inputText.trim()) {
        let vector = spanEmbeddingByNormalized.get(spanNormalized)
        if (!vector) {
            vector = makeEmbedding(spanEmbeddingByNormalized.size * 0.1 + 0.5)
            vector = [...vector]
            vector[0] = spanEmbeddingByNormalized.size * 0.08
            spanEmbeddingByNormalized.set(spanNormalized, vector)
        }
        return {
            success: true,
            embedding: vector,
        } satisfies InvokeBedrockTitanEmbedResult
    }

    let catalogVector = catalogEmbeddingByText.get(catalogNormalized)
    if (!catalogVector) {
        catalogVector = makeEmbedding(catalogEmbeddingByText.size * 0.1 + 0.2)
        catalogVector = [...catalogVector]
        catalogVector[0] = catalogEmbeddingByText.size * 0.06 + 0.3
        catalogEmbeddingByText.set(catalogNormalized, catalogVector)
    }
    return {
        success: true,
        embedding: catalogVector,
    } satisfies InvokeBedrockTitanEmbedResult
})

describe('asymmetricIdentityLadder corpus', () => {
    it('uses unique ids and valid tiers', () => {
        const ids = ASYMMETRIC_IDENTITY_LADDER_CASES.map(({ id }) => id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const ladderCase of ASYMMETRIC_IDENTITY_LADDER_CASES) {
            expect(ASYMMETRIC_IDENTITY_TIER_ORDER).toContain(ladderCase.tier)
            expect(ladderCase.span.trim().length).toBeGreaterThan(0)
            expect(ladderCase.catalogShortName.trim().length).toBeGreaterThan(0)
            expect(ladderCase.description.trim().length).toBeGreaterThan(0)
        }
    })

    it('buildCatalogIndexText composes shortName and description', () => {
        expect(buildCatalogIndexText('shortName', 'broom', 'A straw broom.')).toBe('broom')
        expect(buildCatalogIndexText('descriptionOnly', 'broom', 'A straw broom.')).toBe(
            'A straw broom.'
        )
        expect(buildCatalogIndexText('shortNamePlusDescription', 'broom', 'A straw broom.')).toBe(
            'broom. A straw broom.'
        )
    })
})

describe('runAsymmetricIdentityLadder', () => {
    beforeEach(() => {
        spanEmbeddingByNormalized.clear()
        catalogEmbeddingByText.clear()
        mockInvokeEmbed.mockClear()
    })

    const deps = { invokeEmbed: mockInvokeEmbed }

    it('returns cases sorted by similarity and delta', async () => {
        const result = await runAsymmetricIdentityLadder(undefined, deps)
        expect(result.cases.length).toBe(ASYMMETRIC_IDENTITY_LADDER_CASES.length)
        expect(result.composition).toBe('shortNamePlusDescription')

        const sortedSimilarity = result.sortedBySimilarity.map((entry) => entry.similarity)
        expect(sortedSimilarity).toEqual([...sortedSimilarity].sort((left, right) => right - left))

        const sortedDelta = result.sortedByDelta.map((entry) => entry.delta)
        expect(sortedDelta).toEqual([...sortedDelta].sort((left, right) => right - left))

        for (const ladderCase of result.cases) {
            expect(ladderCase.delta).toBeCloseTo(
                ladderCase.similarity - ladderCase.symmetricSimilarity,
                5
            )
        }
    })

    it('includes composition study results on flagged cases by default', async () => {
        const result = await runAsymmetricIdentityLadder(undefined, deps)
        const studyCases = result.cases.filter((entry) => entry.compositionStudyResults !== undefined)
        expect(studyCases.length).toBe(3)
        for (const studyCase of studyCases) {
            expect(studyCase.compositionStudyResults).toHaveLength(3)
        }
    })

    it('omits composition study when composition override is set', async () => {
        const result = await runAsymmetricIdentityLadder(
            { composition: 'shortName' },
            deps
        )
        expect(result.composition).toBe('shortName')
        expect(
            result.cases.every((entry) => entry.compositionStudyResults === undefined)
        ).toBe(true)
    })

    it('filters by tier when requested', async () => {
        const result = await runAsymmetricIdentityLadder(
            { tier: 'identity-positive-exact' },
            deps
        )
        expect(result.cases.every((entry) => entry.tier === 'identity-positive-exact')).toBe(true)
        expect(result.cases.length).toBe(2)
    })

    it('includes tier summaries with symmetric and delta medians', async () => {
        const result = await runAsymmetricIdentityLadder(undefined, deps)
        expect(result.tierSummaries.length).toBeGreaterThan(0)
        for (const summary of result.tierSummaries) {
            expect(summary.count).toBeGreaterThan(0)
            expect(typeof summary.symmetricMedian).toBe('number')
            expect(typeof summary.deltaMedian).toBe('number')
        }
    })
})
