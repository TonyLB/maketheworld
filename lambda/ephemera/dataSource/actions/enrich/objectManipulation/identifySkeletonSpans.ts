import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { runIdentityStage, type IdentityStageDeps } from './identityStage'
import type { ObjectSpanToken, ParseSkeleton } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'

function isObjectSpanToken(token: ParseSkeleton[number]): token is ObjectSpanToken {
    return token.type === 'objectSpan'
}

export type SkeletonIdentityStageResult =
    | { type: 'success'; spanPools: ReadonlyMap<string, SpanCandidatePool> }
    | { type: 'error'; errorMessage: string }

/**
 * Step 2b, step 4: keys Identify's candidate pools by stableRefKey instead of
 * runIdentityStage's positional array, so relational role-assignment (step 3's
 * matcher) can look a referent's pool up directly rather than by array index.
 * No collision handling needed: stampStableRefKeys.ts guarantees stableRefKey
 * is unique within one skeleton.
 */
export async function runIdentityStageOverSkeleton(
    command: string,
    skeleton: ParseSkeleton,
    catalog: readonly ObjectManipulationCatalogEntry[],
    deps: IdentityStageDeps = {}
): Promise<SkeletonIdentityStageResult> {
    const objectSpanTokens = skeleton.filter(isObjectSpanToken)

    const identityResult = await runIdentityStage(
        command,
        objectSpanTokens.map((token) => token.span),
        catalog,
        deps
    )
    if (identityResult.type === 'error') {
        return identityResult
    }

    return {
        type: 'success',
        spanPools: new Map(
            objectSpanTokens.map((token, index) => [token.stableRefKey, identityResult.spanPools[index]])
        ),
    }
}

/**
 * Identify for the shared producer (ISS8203 slice 2): the referents an attempt names, keyed by
 * stableRefKey, are the set Identify resolves. Spans come from the skeleton in its own order, so
 * `embedSpan` sees the same calls in the same order as the per-route producers did. A key that no
 * skeleton token carries is a construction bug, not a runtime outcome, so it throws.
 */
export async function runIdentityStageOverReferenceKeys(
    command: string,
    skeleton: ParseSkeleton,
    referenceKeys: readonly string[],
    catalog: readonly ObjectManipulationCatalogEntry[],
    deps: IdentityStageDeps = {}
): Promise<SkeletonIdentityStageResult> {
    const keys = new Set(referenceKeys)
    const skeletonKeys = new Set(skeleton.filter(isObjectSpanToken).map((token) => token.stableRefKey))
    for (const key of keys) {
        if (!skeletonKeys.has(key)) {
            throw new Error(`runIdentityStageOverReferenceKeys: stableRefKey "${key}" is not an objectSpan token in the skeleton`)
        }
    }
    const referenced: ParseSkeleton = skeleton.filter((token) => !isObjectSpanToken(token) || keys.has(token.stableRefKey))
    return runIdentityStageOverSkeleton(command, referenced, catalog, deps)
}
