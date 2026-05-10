import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'

const META_IMPORT_PREFIX = 'Meta::Import::'

/**
 * Asset ids used in Meta::Import sort keys with the ASSET# prefix removed.
 */
export function stripAssetIdForSortKey(assetId: string): string {
    return assetId.startsWith('ASSET#') ? assetId.slice('ASSET#'.length) : assetId
}

export function metaImportDataCategory(params: { parentAssetId: string; childAssetId: string }): string {
    const parent = stripAssetIdForSortKey(params.parentAssetId)
    const child = stripAssetIdForSortKey(params.childAssetId)
    return `${META_IMPORT_PREFIX}${parent}::${child}`
}

/** True if DataCategory encodes a hop for the given child asset (suffix ::childStripped). */
export function metaImportSortKeyEndsWithChild(params: { dataCategory: string; childAssetId: string }): boolean {
    const child = stripAssetIdForSortKey(params.childAssetId)
    return params.dataCategory.endsWith(`::${child}`)
}

export type MetaImportStrippedIds = {
    parentStripped: string
    childStripped: string
}

/**
 * Parse a Meta::Import DataCategory into stripped parent/child asset id segments.
 * Returns undefined if the string is not a well-formed Meta::Import sort key.
 */
export function parseMetaImportDataCategory(dataCategory: string): MetaImportStrippedIds | undefined {
    if (!dataCategory.startsWith(META_IMPORT_PREFIX)) {
        return undefined
    }
    const rest = dataCategory.slice(META_IMPORT_PREFIX.length)
    const lastSep = rest.lastIndexOf('::')
    if (lastSep === -1) {
        return undefined
    }
    const parentStripped = rest.slice(0, lastSep)
    const childStripped = rest.slice(lastSep + 2)
    if (!parentStripped || !childStripped) {
        return undefined
    }
    return { parentStripped, childStripped }
}

/** Restore ASSET#... ids from stripped sort-key segments (matches StandardComponent._from shape). */
export function prefixedAssetIdsFromHop(stripped: MetaImportStrippedIds): {
    parentAssetId: AssetUUID
    childAssetId: AssetUUID
} {
    return {
        parentAssetId: AssetKey(stripped.parentStripped),
        childAssetId: AssetKey(stripped.childStripped),
    }
}
