import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { resolveCatalogSpanToPool, type SpanResolver } from './resolveCatalogSpanToPool'
import type { SpanStructure } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'

export type IdentityStageResult =
    | {
        type: 'success'
        /** The pools of the spans the resolver accepted, in span order. */
        spanPools: readonly SpanCandidatePool[]
        /** The span texts the resolver declined; always empty under the full resolver. */
        ineligible: readonly string[]
    }
    | { type: 'error'; errorMessage: string }

export async function runIdentityStage(
    command: string,
    rawObjectSpans: readonly string[],
    catalog: readonly ObjectManipulationCatalogEntry[],
    structures: ReadonlyMap<string, SpanStructure> = new Map(),
    resolver: SpanResolver = resolveCatalogSpanToPool
): Promise<IdentityStageResult> {
    void command
    // Every span's embed starts before any is awaited (`SpanEmbeddings` shares one in-flight call per
    // trimmed span). The error returned is the first in span order, not the first to settle.
    const poolResults = await Promise.all(
        rawObjectSpans.map((rawObjectSpan) => resolver(rawObjectSpan, catalog, structures.get(rawObjectSpan)))
    )
    const spanPools: SpanCandidatePool[] = []
    const ineligible: string[] = []
    for (const [index, poolResult] of poolResults.entries()) {
        if (poolResult.type === 'error') {
            return poolResult
        }
        if (poolResult.type === 'ineligible') {
            ineligible.push(rawObjectSpans[index])
        } else {
            spanPools.push(poolResult.pool)
        }
    }

    return { type: 'success', spanPools, ineligible }
}
