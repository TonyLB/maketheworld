import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'

import { flankLengthMetricsOf, lexicalDiff } from '../lexicalDiff'
import { matchSpanLength } from '../lexicalMatchMetrics'
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

const flankMetricsForPair = (span: string, shortName: string) => {
    const diff = lexicalDiff(span, shortName)
    if (diff === undefined) {
        throw new Error(`no diff of "${span}" against "${shortName}"`)
    }
    return {
        metrics: flankLengthMetricsOf(diff),
        spanScale: Math.max(matchSpanLength(diff.match), diff.pattern.length, 1),
    }
}

const rankCatalogByLexicalRelevance = (
    span: string,
    catalog: readonly string[]
): LexicalRankedCatalogEntry[] => {
    const ranked = catalog.map((shortName) => {
        const lexicalScore = lexicalRelevance(span, shortName)
        const { metrics, spanScale } = flankMetricsForPair(span, shortName)
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
