import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { createSpanEmbedCache } from './embeddingMatch/spanEmbedCache'
import type { ResolveObjectSpanByEmbeddingDeps } from './embeddingMatch/resolveObjectSpanByEmbedding'
import {
    resolveCatalogSpanToPool,
    type ResolveCatalogSpanToPoolDeps,
} from './resolveCatalogSpanToPool'
import type { SpanCandidatePool } from './spanResolution'

export type IdentityStageResult =
    | { type: 'success'; spanPools: readonly SpanCandidatePool[] }
    | { type: 'error'; errorMessage: string }

export type IdentityStageDeps = ResolveCatalogSpanToPoolDeps &
    Pick<ResolveObjectSpanByEmbeddingDeps, 'embedSpan'>

export async function runIdentityStage(
    command: string,
    rawObjectSpans: readonly string[],
    catalog: readonly ObjectManipulationCatalogEntry[],
    deps: IdentityStageDeps = {}
): Promise<IdentityStageResult> {
    void command
    const spanEmbedCache = deps.spanEmbedCache ?? createSpanEmbedCache()
    const spanPools: SpanCandidatePool[] = []

    for (const rawObjectSpan of rawObjectSpans) {
        const poolResult = await resolveCatalogSpanToPool(rawObjectSpan, catalog, {
            embedSpan: deps.embedSpan,
            spanEmbedCache,
        })
        if (poolResult.type === 'error') {
            return poolResult
        }
        spanPools.push(poolResult.pool)
    }

    return { type: 'success', spanPools }
}
