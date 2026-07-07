import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'

import {
    EMBEDDING_CALIBRATION_BUCKETS,
    EMBEDDING_CALIBRATION_IDENTITY_CASES,
    EMBEDDING_CALIBRATION_PAIR_CASES,
    type EmbeddingCalibrationBucket,
} from './corpus'

describe('EMBEDDING_CALIBRATION corpus', () => {
    const allIds = [
        ...EMBEDDING_CALIBRATION_PAIR_CASES.map(({ id }) => id),
        ...EMBEDDING_CALIBRATION_IDENTITY_CASES.map(({ id }) => id),
    ]

    it('uses unique non-empty ids across pair and identity cases', () => {
        expect(allIds.every((id) => typeof id === 'string' && id.trim().length > 0)).toBe(true)
        expect(new Set(allIds).size).toBe(allIds.length)
    })

    it('covers every calibration bucket at least once', () => {
        const buckets = new Set<EmbeddingCalibrationBucket>([
            ...EMBEDDING_CALIBRATION_PAIR_CASES.map(({ bucket }) => bucket),
            ...EMBEDDING_CALIBRATION_IDENTITY_CASES.map(({ bucket }) => bucket),
        ])
        for (const bucket of EMBEDDING_CALIBRATION_BUCKETS) {
            expect(buckets.has(bucket)).toBe(true)
        }
    })

    it('stores valid pair case rows', () => {
        for (const entry of EMBEDDING_CALIBRATION_PAIR_CASES) {
            expect(entry.left.trim().length).toBeGreaterThan(0)
            expect(entry.right.trim().length).toBeGreaterThan(0)
            expect(EMBEDDING_CALIBRATION_BUCKETS).toContain(entry.bucket)
        }
    })

    it('stores valid identity case rows', () => {
        for (const entry of EMBEDDING_CALIBRATION_IDENTITY_CASES) {
            expect(entry.span.trim().length).toBeGreaterThan(0)
            expect(entry.catalog.length).toBeGreaterThanOrEqual(1)
            expect(entry.catalog.every((shortName) => shortName.trim().length > 0)).toBe(true)
            expect(EMBEDDING_CALIBRATION_BUCKETS).toContain(entry.bucket)
        }
    })

    it('keeps distinct case texts from collapsing under embedding normalization', () => {
        const pairTexts = EMBEDDING_CALIBRATION_PAIR_CASES.flatMap(({ left, right }) => [left, right])
        const identityTexts = EMBEDDING_CALIBRATION_IDENTITY_CASES.flatMap(({ span, catalog }) => [
            span,
            ...catalog,
        ])
        const normalized = [...pairTexts, ...identityTexts].map((text) => normalizeShortNameForEmbedding(text))
        const distinctInputs = new Set([...pairTexts, ...identityTexts])
        expect(new Set(normalized).size).toBe(distinctInputs.size)
    })
})
