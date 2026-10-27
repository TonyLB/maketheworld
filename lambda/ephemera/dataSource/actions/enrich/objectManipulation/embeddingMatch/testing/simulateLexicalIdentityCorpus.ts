import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'

import { lexicalDiff } from '../lexicalDiff'
import { lexicalRelevance } from '../lexicalRelevance'
import { catalogSideFlankInputs } from '../lexicalWeights'
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

/** The flank scores of a pair, or 0 where no pair of its words is close enough to align. */
const flankScoresForPair = (span: string, shortName: string): { tanh: number; multiplicative: number } => {
    const diff = lexicalDiff(span, shortName)
    if (diff === undefined) {
        return { tanh: 0, multiplicative: 0 }
    }
    const { metrics, spanScale } = catalogSideFlankInputs(diff)
    return { tanh: tanhCenteredFlankScore(metrics, spanScale), multiplicative: multiplicativeFlankScoreV1(metrics, spanScale) }
}

const rankCatalogByLexicalRelevance = (
    span: string,
    catalog: readonly string[]
): LexicalRankedCatalogEntry[] => {
    const ranked = catalog.map((shortName) => {
        const { tanh, multiplicative } = flankScoresForPair(span, shortName)
        return {
            shortName,
            lexicalScore: lexicalRelevance(span, shortName),
            tanhFlankScore: tanh,
            multiplicativeFlankScore: multiplicative,
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
