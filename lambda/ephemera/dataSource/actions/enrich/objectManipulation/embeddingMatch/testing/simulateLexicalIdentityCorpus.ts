import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'
import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import {
    computeLexicalMatchMetrics,
    matchSpanLength,
} from '../lexicalMatchMetrics'
import { lexicalRelevance } from '../lexicalRelevance'
import {
    multiplicativeFlankScoreV1,
    tanhCenteredFlankScore,
} from '../relevanceCombine'

export type LexicalRankedCatalogEntry = {
    shortName: string
    lexicalScore: number
    tanhFlankScore: number
    multiplicativeFlankScore: number
}

export type LexicalIdentityCorpusResult = {
    caseId: string
    bucket: string
    span: string
    ranked: LexicalRankedCatalogEntry[]
    topLexicalScore: number
}

const lexicalMetricsForPair = (span: string, shortName: string) => {
    const normalizedSpan = normalizeShortNameForEmbedding(span)
    const normalizedShortName = normalizeShortNameForEmbedding(shortName)
    const [pattern, candidateText] = normalizedSpan.length <= normalizedShortName.length
        ? [normalizedSpan, normalizedShortName]
        : [normalizedShortName, normalizedSpan]

    return {
        metrics: computeLexicalMatchMetrics(pattern, candidateText),
        patternLength: pattern.length,
    }
}

const rankCatalogByLexicalRelevance = (
    span: string,
    catalog: readonly string[]
): LexicalRankedCatalogEntry[] => {
    const ranked = catalog.map((shortName) => {
        const lexicalScore = lexicalRelevance(span, shortName)
        const { metrics, patternLength } = lexicalMetricsForPair(span, shortName)
        const spanScale = Math.max(matchSpanLength(metrics.matchSpan), patternLength, 1)
        return {
            shortName,
            lexicalScore,
            tanhFlankScore: tanhCenteredFlankScore(metrics, spanScale),
            multiplicativeFlankScore: multiplicativeFlankScoreV1(metrics, spanScale),
        }
    })

    return ranked.sort((left, right) => right.lexicalScore - left.lexicalScore)
}

export const simulateLexicalIdentityCorpus = (): LexicalIdentityCorpusResult[] => (
    EMBEDDING_CALIBRATION_IDENTITY_CASES.map((identityCase) => {
        const ranked = rankCatalogByLexicalRelevance(identityCase.span, identityCase.catalog)
        return {
            caseId: identityCase.id,
            bucket: identityCase.bucket,
            span: identityCase.span,
            ranked,
            topLexicalScore: ranked[0]?.lexicalScore ?? 0,
        }
    })
)
