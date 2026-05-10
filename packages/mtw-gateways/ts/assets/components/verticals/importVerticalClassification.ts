/** Per-partition: both orphan and missing rows implies stale (wrong hops). */
export function classifyImportVerticalSets(
    expectedCategories: Set<string>,
    existingCategories: Set<string>
): 'aligned' | 'missing' | 'orphan' | 'stale' {
    let missing = false
    for (const x of expectedCategories) {
        if (!existingCategories.has(x)) missing = true
    }
    let orphan = false
    for (const x of existingCategories) {
        if (!expectedCategories.has(x)) orphan = true
    }
    if (!missing && !orphan) return 'aligned'
    if (missing && orphan) return 'stale'
    if (missing) return 'missing'
    return 'orphan'
}

/** Priority matches repair severity: stale (replace) over orphan over missing (insert-only). */
export function aggregateMisalignmentStatuses(
    parts: Array<'aligned' | 'missing' | 'orphan' | 'stale'>
): 'missing' | 'orphan' | 'stale' | null {
    const bad = parts.filter((s): s is 'missing' | 'orphan' | 'stale' => s !== 'aligned')
    if (bad.length === 0) return null
    if (bad.some((s) => s === 'stale')) return 'stale'
    if (bad.some((s) => s === 'orphan')) return 'orphan'
    return 'missing'
}
