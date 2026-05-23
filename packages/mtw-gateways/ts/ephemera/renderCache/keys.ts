export const EPHEMERA_CACHE_DATA_CATEGORY_PREFIX = 'CACHE#' as const

export const EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX = 'Cache::' as const

export type EphemeraCacheCatalogDataCategory = `${typeof EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}${string}`

export const buildCacheCatalogDataCategory = (perspectiveKey: string): EphemeraCacheCatalogDataCategory =>
    `${EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX}${perspectiveKey}`

export const perspectiveKeyFromCatalogDataCategory = (dataCategory: string): string | undefined => {
    if (!dataCategory.startsWith(EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX)) {
        return undefined
    }
    const key = dataCategory.slice(EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX.length)
    return key.length > 0 ? key : undefined
}

export const catalogRowsCacheKey = (componentId: string): string => `${componentId}::catalogRows`

export const catalogRowCacheKey = (componentId: string, perspectiveKey: string): string =>
    `${componentId}::catalog::${perspectiveKey}`
