import type { InvokeBedrockTitanEmbedResult } from '../../llm/invokeBedrockTitanEmbed'
import { SEMANTIC_EMBEDDING_V1_DIMENSIONS } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import fs from 'fs'
import path from 'path'

import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import {
    calibrationRunMetadata,
    runFullEmbeddingCalibration,
} from './runEmbeddingCalibration'

const embeddingByNormalized = new Map<string, number[]>()

const makeEmbedding = (seed: number): number[] =>
    Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, (_, index) =>
        index === 0 ? seed : index * 0.0001
    )

const mockInvokeEmbed = async ({ inputText }: { inputText: string }) => {
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
}

/**
 * Generates embedding-identity-pool-v1 snapshot from deterministic mock Bedrock vectors.
 * Skipped by default (rewrites a committed snapshot's `calibratedAt` on every run, which
 * is only wanted when deliberately refreshing FT-1.3 calibration artifacts). Run with:
 * RUN_CALIBRATION=1 npm run test -- --watchAll=false calibration/objectMatch/generatePoolCalibrationSnapshot.test.ts
 */
;(process.env.RUN_CALIBRATION ? describe : describe.skip)('generatePoolCalibrationSnapshot', () => {
    it('writes pool calibration snapshot JSON (FT-1.3.6 biasMax sweep)', async () => {
        embeddingByNormalized.clear()
        const result = await runFullEmbeddingCalibration(undefined, { invokeEmbed: mockInvokeEmbed })
        const payload = {
            snapshotId: 'embedding-identity-pool-v1-2026-07-09-bias-sweep',
            note: 'Mock Bedrock vectors (Jest harness). FT-1.3.2-6: coverage bias, ratio-invariant adjoined + remote, flank weights w_adjoined=3.0 w_remote=0.4, biasMax=1.5. a/axe lex below T_JOINT_ABS; gem/don morphology symmetric. Re-run EmbeddingCalibrationCorpus on dev stack for live Titan confirmation.',
            ...calibrationRunMetadata(),
            ...result,
        }
        const outPath = path.join(
            __dirname,
            'snapshots',
            'embedding-identity-pool-v1-2026-07-09-bias-sweep.json'
        )
        fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
        expect(payload.snapshotId).toBe('embedding-identity-pool-v1-2026-07-09-bias-sweep')
        expect(result.identity.bucketSummaries[0]?.topJointRelevanceStats).toBeDefined()
        expect(fs.existsSync(outPath)).toBe(true)
    })
})
