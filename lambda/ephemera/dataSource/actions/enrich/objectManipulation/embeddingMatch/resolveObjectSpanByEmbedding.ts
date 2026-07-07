import type { EmbeddingMatchCandidate, EmbeddingMatchDecision } from './types'

export type ResolveObjectSpanByEmbeddingDeps = {
    embedSpan?: (rawObjectSpan: string) => Promise<{ success: true; embedding: import('@tonylb/mtw-lambda-patterns/ts/semanticEmbedding').SemanticEmbedding } | { success: false }>
}

/**
 * EM-5 orchestrator: embed span -> rank pre-attached catalog vectors -> decide.
 * Not wired into identity stage until EM-5.
 */
export async function resolveObjectSpanByEmbedding(
    _rawObjectSpan: string,
    _candidates: readonly EmbeddingMatchCandidate[],
    _deps: ResolveObjectSpanByEmbeddingDeps = {}
): Promise<EmbeddingMatchDecision> {
    throw new Error('resolveObjectSpanByEmbedding is not implemented until EM-5')
}
