import type { RoomExit } from '../../baseClasses'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { exitSpanPool } from './exitSpanPool'
import { runIdentityStage, type IdentityStageDeps } from './identityStage'
import type { ObjectSpanToken, ParseSkeleton, SpanStructure } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'

function isObjectSpanToken(token: ParseSkeleton[number]): token is ObjectSpanToken {
    return token.type === 'objectSpan'
}

/** What spans ground against, by catalog (`SpanCatalog`): the objects in the room and in hand, and the room's exits. */
export type SpanCatalogs = {
    objects: readonly ObjectManipulationCatalogEntry[]
    exits: readonly RoomExit[]
}

export type SkeletonIdentityStageResult =
    | { type: 'success'; spanPools: ReadonlyMap<string, SpanCandidatePool> }
    | { type: 'error'; errorMessage: string }

/**
 * Step 2b, step 4: keys Identify's candidate pools by stableRefKey instead of
 * runIdentityStage's positional array, so relational role-assignment (step 3's
 * matcher) can look a referent's pool up directly rather than by array index.
 * Each span grounds against its own catalog (`ObjectSpanToken.catalog`). An object span's pool
 * depends only on its text, so each distinct text is identified once, in order of first appearance,
 * and every key holding that text (two occurrences, `benchRef1` and `benchRef2`) shares its pool;
 * Identify scores a text with the union of its occurrences' structure (`SpanStructure`).
 * Identify runs, and can fail for want of a catalog, only when there is an object span to ground.
 * An exit span's pool is the exits' exact match (`exitSpanPool`).
 */
export async function runIdentityStageOverSkeleton(
    command: string,
    skeleton: ParseSkeleton,
    catalogs: SpanCatalogs,
    deps: IdentityStageDeps = {}
): Promise<SkeletonIdentityStageResult> {
    const spanTokens = skeleton.filter(isObjectSpanToken)
    const objectSpanTokens = spanTokens.filter((token) => token.catalog === undefined)
    const texts = [...new Set(objectSpanTokens.map((token) => token.span))]

    // A text's structure is the union of its occurrences' alternatives (the same text can sit in two ranges).
    const structures = new Map<string, SpanStructure>(texts.flatMap((text) => {
        const held = objectSpanTokens.filter((token) => token.span === text && token.structure !== undefined).map((token) => token.structure!)
        const alternatives = [...new Map(held.flatMap((structure) => structure.alternatives).map((range) => [`${range.start}-${range.end}`, range])).values()]
        return held.length === 0 ? [] : [[text, { tokens: held[0].tokens, alternatives }] as const]
    }))
    const identityResult = texts.length > 0
        ? await runIdentityStage(command, texts, catalogs.objects, deps, structures)
        : { type: 'success' as const, spanPools: [] }
    if (identityResult.type === 'error') {
        return identityResult
    }

    const poolOf = new Map(texts.map((text, index) => [text, identityResult.spanPools[index]]))
    return {
        type: 'success',
        spanPools: new Map(spanTokens.map((token) => [
            token.stableRefKey,
            token.catalog === 'exits' ? exitSpanPool(token.span, catalogs.exits) : poolOf.get(token.span)!,
        ])),
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
    catalogs: SpanCatalogs,
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
    return runIdentityStageOverSkeleton(command, referenced, catalogs, deps)
}
