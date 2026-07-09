import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'
import {
    catalogScopeToLocus,
    type ObjectSpanCandidate,
    type SpanCandidatePool,
    type SpanRelevanceSourceTag,
} from '../spanResolution'

import { buildAdmissibleShortSpans, isLexicalChannelActive } from './admissibleShortSpans'
import { embedRelevance } from './embedRelevance'
import { gapTrimShortlist } from './gapTrimShortlist'
import { lexicalRelevance } from './lexicalRelevance'
import { weightedRmsJointRelevance } from './relevanceCombine'
import type { RelevanceNormalizationParams } from './thresholds'
import type { EmbeddingMatchCandidate } from './types'

export type BuildSpanCandidatePoolOptions = {
    spanEmbedding?: SemanticEmbedding
    params?: RelevanceNormalizationParams
}

const buildSourceTags = (
    lexicalChannelActive: boolean,
    hasSpanEmbedding: boolean,
    lexRelevance: number | undefined,
    embedRelevanceScore: number | undefined
): readonly SpanRelevanceSourceTag[] => {
    const tags: SpanRelevanceSourceTag[] = []
    if (lexRelevance !== undefined) {
        tags.push('lexical')
    }
    if (embedRelevanceScore !== undefined) {
        tags.push('embedding')
    }
    if (tags.length > 0) {
        return tags
    }
    if (lexicalChannelActive) {
        return ['lexical']
    }
    if (hasSpanEmbedding) {
        return ['embedding']
    }
    return ['embedding']
}

const attachMargins = (ranked: ObjectSpanCandidate[]): ObjectSpanCandidate[] => (
    ranked.map((candidate, index) => {
        const runnerUp = ranked[index + 1]
        if (!runnerUp) {
            return candidate
        }
        const marginToRunnerUp = Math.max(0, candidate.jointRelevance - runnerUp.jointRelevance)
        return { ...candidate, marginToRunnerUp }
    })
)

/**
 * FT-1.2 rank-all candidate pool: embed + lexical relevance, weighted RMS joint score,
 * full ranked list, and gap-trim shortlist.
 */
export function buildSpanCandidatePool(
    span: string,
    candidates: readonly EmbeddingMatchCandidate[],
    options: BuildSpanCandidatePoolOptions = {}
): SpanCandidatePool {
    const params = options.params ?? {}
    const normalizedSpan = normalizeShortNameForEmbedding(span)
    const admissibleShortSpans = buildAdmissibleShortSpans(
        candidates.map(({ normalizedShortName }) => ({ normalizedShortName })),
        params.sMin
    )
    const lexicalChannelActive = isLexicalChannelActive(normalizedSpan, admissibleShortSpans, params.sMin)
    const hasSpanEmbedding = options.spanEmbedding !== undefined

    const scored = candidates.map((candidate) => {
        const embedRelevanceScore = candidate.embedding && options.spanEmbedding
            ? embedRelevance(
                options.spanEmbedding.cosineSimilarity(candidate.embedding),
                params
            )
            : undefined

        const lexRelevanceScore = lexicalChannelActive
            ? lexicalRelevance(span, candidate.normalizedShortName, params)
            : undefined

        const jointRelevance = weightedRmsJointRelevance(
            { lex: lexRelevanceScore, embed: embedRelevanceScore },
            params
        )

        const spanCandidate: ObjectSpanCandidate = {
            id: candidate.objectId,
            label: candidate.normalizedShortName,
            jointRelevance,
            ...(lexRelevanceScore !== undefined ? { lexRelevance: lexRelevanceScore } : {}),
            ...(embedRelevanceScore !== undefined ? { embedRelevance: embedRelevanceScore } : {}),
            sourceTags: buildSourceTags(
                lexicalChannelActive,
                hasSpanEmbedding,
                lexRelevanceScore,
                embedRelevanceScore
            ),
            locus: catalogScopeToLocus(candidate.catalogScope),
        }

        return spanCandidate
    })

    const ranked = attachMargins(
        [...scored].sort((left, right) => right.jointRelevance - left.jointRelevance)
    )

    return {
        span,
        candidates: ranked,
        shortlist: gapTrimShortlist(ranked, params),
    }
}
