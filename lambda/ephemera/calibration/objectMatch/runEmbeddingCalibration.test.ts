import type { InvokeBedrockTitanEmbedResult } from '../../llm/invokeBedrockTitanEmbed'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import {
    bucketStats,
    compareEmbeddingPair,
    median,
    runFullEmbeddingCalibration,
    runIdentityCorpus,
    runPairCorpus,
    simulateIdentityCalibration,
} from './runEmbeddingCalibration'

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
        embeddingByNormalized.set(normalized, vector)
    }
    return {
        success: true,
        embedding: vector,
    } satisfies InvokeBedrockTitanEmbedResult
})

describe('runEmbeddingCalibration helpers', () => {
    it('median handles even and odd lengths', () => {
        expect(median([1, 3, 5])).toBe(3)
        expect(median([1, 2, 3, 4])).toBe(2.5)
        expect(median([])).toBe(0)
    })

    it('bucketStats aggregates min/median/max', () => {
        expect(bucketStats([0.2, 0.5, 0.8])).toEqual({
            min: 0.2,
            median: 0.5,
            max: 0.8,
            count: 3,
        })
    })
})

describe('runEmbeddingCalibration', () => {
    beforeEach(() => {
        embeddingByNormalized.clear()
        mockInvokeEmbed.mockClear()
    })

    const deps = { invokeEmbed: mockInvokeEmbed }

    it('compareEmbeddingPair returns similarity for two strings', async () => {
        const result = await compareEmbeddingPair('broom', 'sweeping tool', deps)
        expect('error' in result).toBe(false)
        if ('error' in result) {
            return
        }
        expect(result.similarity).toBeGreaterThanOrEqual(-1)
        expect(result.similarity).toBeLessThanOrEqual(1)
        expect(result.leftNormalized).toBe(normalizeShortNameForEmbedding('broom'))
    })

    it('dedupes embed calls across pair corpus cases', async () => {
        await runPairCorpus(undefined, deps)
        const uniqueNormalized = new Set<string>()
        for (const pairCase of [
            { left: 'broom', right: 'sweeping tool' },
            { left: 'broom', right: 'lantern' },
        ]) {
            uniqueNormalized.add(normalizeShortNameForEmbedding(pairCase.left))
            uniqueNormalized.add(normalizeShortNameForEmbedding(pairCase.right))
        }
        expect(mockInvokeEmbed.mock.calls.length).toBeLessThanOrEqual(uniqueNormalized.size + 4)
    })

    it('runPairCorpus returns bucket summaries', async () => {
        const result = await runPairCorpus(undefined, deps)
        expect(result.cases.length).toBeGreaterThan(0)
        expect(result.bucketSummaries.length).toBeGreaterThan(0)
        expect(result.bucketSummaries[0]).toMatchObject({
            bucket: expect.any(String),
            min: expect.any(Number),
            median: expect.any(Number),
            max: expect.any(Number),
            count: expect.any(Number),
        })
    })

    it('filters pair corpus by bucket', async () => {
        const result = await runPairCorpus('hard-negative', deps)
        expect(result.cases.every((entry) => entry.bucket === 'hard-negative')).toBe(true)
    })

    it('simulateIdentityCalibration returns ranked scores and decision', async () => {
        const result = await simulateIdentityCalibration(
            { span: 'sword', catalog: ['broom', 'anvil', 'lantern'] },
            deps
        )
        expect('error' in result).toBe(false)
        if ('error' in result) {
            return
        }
        expect(result.rankedScores.length).toBe(3)
        expect(result.decision.type).toMatch(/Resolved|Abstain/)
        expect(result.thresholds.T_ABS).toBeDefined()
        expect(result.corpusCaseId).toBe('identity-001-absent-sword')
    })

    it('runIdentityCorpus includes margin/ratio comparison block', async () => {
        const result = await runIdentityCorpus(undefined, deps)
        expect(result.cases.length).toBeGreaterThan(0)
        expect(result.marginRatioComparison.absoluteGap.count).toBeGreaterThanOrEqual(0)
        expect(result.marginRatioComparison.note).toContain('EM-D2')
    })

    it('runIdentityCorpus includes pool-metrics bucket summaries', async () => {
        const result = await runIdentityCorpus(undefined, deps)
        const summary = result.bucketSummaries.find((entry) => entry.bucket === 'positive-paraphrase')
        expect(summary).toBeDefined()
        expect(summary!.topJointRelevanceStats.count).toBeGreaterThan(0)
        expect(summary!.topMarginStats).toMatchObject({
            min: expect.any(Number),
            median: expect.any(Number),
            max: expect.any(Number),
            count: expect.any(Number),
        })
        expect(summary!.suggestedJointFloorHeadroom).toContain('T_JOINT_ABS')
    })

    it('runIdentityCorpus admissibility off does not change identity corpus ranking', async () => {
        const onResult = await runIdentityCorpus(undefined, deps, { lexicalChannelPolicy: 'admissibility' })
        const offResult = await runIdentityCorpus(undefined, deps, { lexicalChannelPolicy: 'alwaysActive' })
        for (const onCase of onResult.cases) {
            const offCase = offResult.cases.find((entry) => entry.id === onCase.id)
            expect(offCase).toBeDefined()
            expect(offCase!.pool?.candidates.map((c) => c.label)).toEqual(
                onCase.pool?.candidates.map((c) => c.label)
            )
        }
    })

    it('runFullEmbeddingCalibration returns metadata and both corpora', async () => {
        const result = await runFullEmbeddingCalibration(undefined, deps)
        expect(result.metadata.corpusId).toBe('embedding-identity-v1')
        expect(result.metadata.modelId).toContain('titan-embed')
        expect(result.pairs.cases.length).toBeGreaterThan(0)
        expect(result.identity.cases.length).toBeGreaterThan(0)
    })

    it('rejects empty normalized span', async () => {
        const result = await compareEmbeddingPair('   ', 'broom', deps)
        expect(result).toEqual({ error: 'left and right must normalize to non-empty strings' })
    })
})
