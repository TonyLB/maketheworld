/**
 * Object-embedding identity calibration corpus (source of truth in git).
 * Shared by Jest (mocked vectors) and EM-4 live Bedrock calibration tooling.
 */

export const EMBEDDING_CALIBRATION_CORPUS_ID = 'embedding-identity-v1' as const

export type EmbeddingCalibrationBucket =
    | 'positive-paraphrase'
    | 'hard-negative'
    | 'absent-object'
    | 'unary-trap'
    | 'synonym-without-shared-tokens'
    | 'duplicate-shortName'

export type EmbeddingCalibrationPairCase = {
    id: string
    bucket: EmbeddingCalibrationBucket
    left: string
    right: string
    tags?: string[]
    expectSimilarity?: 'high' | 'medium' | 'low'
    notes?: string
}

export type EmbeddingCalibrationIdentityCase = {
    id: string
    bucket: EmbeddingCalibrationBucket
    span: string
    catalog: readonly string[]
    tags?: string[]
    expectedVerdict?: 'resolve' | 'abstain'
    expectedObjectIndex?: number
    abstainReason?: 'below_floor' | 'ambiguous_margin' | 'no_eligible_embeddings'
    notes?: string
}

export const EMBEDDING_CALIBRATION_PAIR_CASES: readonly EmbeddingCalibrationPairCase[] = [
    {
        id: 'pair-001-broom-paraphrase',
        bucket: 'positive-paraphrase',
        left: 'broom',
        right: 'sweeping tool',
        expectSimilarity: 'high',
        notes: 'Canonical paraphrase fast-path example from planning doc.',
    },
    {
        id: 'pair-002-sword-rapier',
        bucket: 'synonym-without-shared-tokens',
        left: 'sword',
        right: 'ornate rapier',
        expectSimilarity: 'high',
        notes: 'No lexical overlap; unary-trap and synonym calibration.',
    },
    {
        id: 'pair-003-broom-lantern',
        bucket: 'hard-negative',
        left: 'broom',
        right: 'lantern',
        expectSimilarity: 'low',
        notes: 'Distinct room objects; margin should separate from paraphrase hits.',
    },
    {
        id: 'pair-004-anvil-hammer',
        bucket: 'hard-negative',
        left: 'anvil',
        right: 'hammer',
        expectSimilarity: 'medium',
        notes: 'Workshop-adjacent but distinct objects in multi-object catalog.',
    },
]

export const EMBEDDING_CALIBRATION_IDENTITY_CASES: readonly EmbeddingCalibrationIdentityCase[] = [
    {
        id: 'identity-001-absent-sword',
        bucket: 'absent-object',
        span: 'sword',
        catalog: ['broom', 'anvil', 'lantern'],
        expectedVerdict: 'abstain',
        abstainReason: 'below_floor',
        notes: 'Primary T_abs guard when requested object is absent from catalog.',
    },
    {
        id: 'identity-002-unary-trap',
        bucket: 'unary-trap',
        span: 'sword',
        catalog: ['ornate rapier'],
        expectedVerdict: 'abstain',
        notes: 'Calibrate T_abs_unary > T_abs for sole catalog object without lexical overlap.',
    },
    {
        id: 'identity-003-broom-paraphrase',
        bucket: 'positive-paraphrase',
        span: 'sweeping tool',
        catalog: ['broom', 'anvil', 'lantern'],
        expectedVerdict: 'resolve',
        expectedObjectIndex: 0,
        notes: 'Multi-object catalog; paraphrase should resolve to broom when gates pass.',
    },
    {
        id: 'identity-004-duplicate-shortname',
        bucket: 'duplicate-shortName',
        span: 'lantern',
        catalog: ['lantern', 'lantern'],
        expectedVerdict: 'abstain',
        notes: 'Identical normalized shortNames; embedding must never auto-resolve.',
    },
    {
        id: 'identity-005-hard-negative-span',
        bucket: 'hard-negative',
        span: 'sweeping tool',
        catalog: ['lantern', 'anvil'],
        expectedVerdict: 'abstain',
        abstainReason: 'below_floor',
        notes: 'Paraphrase-like span with no matching object in catalog.',
    },
    {
        id: 'identity-006-synonym-unary',
        bucket: 'synonym-without-shared-tokens',
        span: 'blade',
        catalog: ['ornate rapier'],
        expectedVerdict: 'abstain',
        notes: 'Unary synonym without shared tokens; high bar via T_abs_unary.',
    },
]

export const EMBEDDING_CALIBRATION_BUCKETS: readonly EmbeddingCalibrationBucket[] = [
    'positive-paraphrase',
    'hard-negative',
    'absent-object',
    'unary-trap',
    'synonym-without-shared-tokens',
    'duplicate-shortName',
]

export function filterCasesByBucket<T extends { bucket: EmbeddingCalibrationBucket }>(
    cases: readonly T[],
    bucket?: EmbeddingCalibrationBucket
): readonly T[] {
    if (bucket === undefined) {
        return cases
    }
    return cases.filter((entry) => entry.bucket === bucket)
}
