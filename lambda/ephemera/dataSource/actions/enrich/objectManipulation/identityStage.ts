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
    const spanPools: SpanCandidatePool[] = []

    for (const rawObjectSpan of rawObjectSpans) {
        const poolResult = await resolveCatalogSpanToPool(rawObjectSpan, catalog, structures.get(rawObjectSpan))
        if (poolResult.type === 'error') {
            return poolResult
        }
        spanPools.push(poolResult.pool)
    }

    return { type: 'success', spanPools }
}
