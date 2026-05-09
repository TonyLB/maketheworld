/**
 * Sort keys for Meta::Import hop rows (component vertical denormalization).
 * Parent and child segments use asset ids with the ASSET# prefix stripped.
 */
export function stripAssetIdForSortKey(assetId: string): string {
    return assetId.startsWith('ASSET#') ? assetId.slice('ASSET#'.length) : assetId
}

export function metaImportDataCategory(params: { parentAssetId: string; childAssetId: string }): string {
    const parent = stripAssetIdForSortKey(params.parentAssetId)
    const child = stripAssetIdForSortKey(params.childAssetId)
    return `Meta::Import::${parent}::${child}`
}

/** True if DataCategory encodes a hop for the given child asset (suffix ::childStripped). */
export function metaImportSortKeyEndsWithChild(params: { dataCategory: string; childAssetId: string }): boolean {
    const child = stripAssetIdForSortKey(params.childAssetId)
    return params.dataCategory.endsWith(`::${child}`)
}
