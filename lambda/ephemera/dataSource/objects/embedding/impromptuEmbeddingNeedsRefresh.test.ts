import { createHash } from 'node:crypto'

import type { EphemeraObjectEmbedding } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import { EMBEDDING_IMPROMPTU_DATA_CATEGORY } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SEMANTIC_EMBEDDING_V1_ENCODING,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { BEDROCK_TITAN_EMBED_MODEL_ID } from '../../../llm/invokeBedrockTitanEmbed'
import {
    hashShortNameForEmbedding,
    impromptuEmbeddingNeedsRefresh,
    normalizeShortNameForEmbedding,
} from './impromptuEmbeddingNeedsRefresh'

const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

const makePriorRow = (
    overrides: Partial<EphemeraObjectEmbedding['embedding']> = {}
): EphemeraObjectEmbedding => ({
    EphemeraId: 'OBJECT#Anvil',
    DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
    embedding: {
        modelId: BEDROCK_TITAN_EMBED_MODEL_ID,
        dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
        encoding: SEMANTIC_EMBEDDING_V1_ENCODING,
        vector: new Uint8Array(SEMANTIC_EMBEDDING_V1_DIMENSIONS),
        sourceTextHash: sha256Hex('brass lantern'),
        ...overrides,
    },
})

describe('normalizeShortNameForEmbedding', () => {
    it('trims and normalizes exit name', () => {
        expect(normalizeShortNameForEmbedding('  Brass   Lantern  ')).toBe('brass lantern')
    })
})

describe('hashShortNameForEmbedding', () => {
    it('returns SHA-256 hex of normalized text', () => {
        expect(hashShortNameForEmbedding('brass lantern')).toBe(sha256Hex('brass lantern'))
    })
})

describe('impromptuEmbeddingNeedsRefresh', () => {
    it('returns false when hash and metadata match', () => {
        expect(impromptuEmbeddingNeedsRefresh('brass lantern', makePriorRow())).toBe(false)
    })

    it('returns true when prior row is absent', () => {
        expect(impromptuEmbeddingNeedsRefresh('brass lantern', undefined)).toBe(true)
    })

    it('returns true when sourceTextHash mismatches', () => {
        expect(impromptuEmbeddingNeedsRefresh('iron anvil', makePriorRow())).toBe(true)
    })

    it('returns true when sourceTextHash is missing', () => {
        expect(
            impromptuEmbeddingNeedsRefresh('brass lantern', makePriorRow({ sourceTextHash: undefined }))
        ).toBe(true)
    })

    it('returns true when modelId differs', () => {
        expect(
            impromptuEmbeddingNeedsRefresh(
                'brass lantern',
                makePriorRow({ modelId: 'other-model' })
            )
        ).toBe(true)
    })

    it('returns false when shortName is empty after normalization', () => {
        expect(impromptuEmbeddingNeedsRefresh('   ', undefined)).toBe(false)
        expect(impromptuEmbeddingNeedsRefresh('   ', makePriorRow())).toBe(false)
    })
})
