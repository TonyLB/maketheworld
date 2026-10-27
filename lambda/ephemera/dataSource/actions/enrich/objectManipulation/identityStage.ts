import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { resolveCatalogSpanToPool } from './resolveCatalogSpanToPool'
import type { SpanStructure } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'

export type IdentityStageResult =
    | { type: 'success'; spanPools: readonly SpanCandidatePool[] }
    | { type: 'error'; errorMessage: string }

export async function runIdentityStage(
    command: string,
    rawObjectSpans: readonly string[],
    catalog: readonly ObjectManipulationCatalogEntry[],
    structures: ReadonlyMap<string, SpanStructure> = new Map()
): Promise<IdentityStageResult> {
    void command
    // Every span's embed starts before any is awaited (`SpanEmbeddings` shares one in-flight call per
    // trimmed span). The error returned is the first in span order, not the first to settle.
    const poolResults = await Promise.all(
        rawObjectSpans.map((rawObjectSpan) => resolveCatalogSpanToPool(rawObjectSpan, catalog, structures.get(rawObjectSpan)))
    )
    const spanPools: SpanCandidatePool[] = []
    for (const poolResult of poolResults) {
        if (poolResult.type === 'error') {
            return poolResult
        }
        spanPools.push(poolResult.pool)
    }

    return { type: 'success', spanPools }
}
