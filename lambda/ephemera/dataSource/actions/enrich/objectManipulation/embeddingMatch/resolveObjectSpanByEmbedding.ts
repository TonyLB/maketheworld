import type { EmbedObjectSpanResult } from '../../../../objects/embedding/embedObjectSpan'
import type { EmbeddingMatchCandidate, EmbeddingMatchDecision } from './types'

export type ResolveObjectSpanByEmbeddingDeps = {
    embedSpan?: (rawObjectSpan: string) => Promise<EmbedObjectSpanResult>
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
