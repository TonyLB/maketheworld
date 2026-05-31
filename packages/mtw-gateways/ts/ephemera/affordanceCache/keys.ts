export const EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX = 'Affordance::' as const

export type EphemeraAffordanceDataCategory = `${typeof EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX}${string}`

export const buildAffordanceDataCategory = (perspectiveKey: string): EphemeraAffordanceDataCategory =>
    `${EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX}${perspectiveKey}`

export const perspectiveKeyFromAffordanceDataCategory = (dataCategory: string): string | undefined => {
    if (!dataCategory.startsWith(EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX)) {
        return undefined
    }
    const key = dataCategory.slice(EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX.length)
    return key.length > 0 ? key : undefined
}

export const affordanceRowsCacheKey = (roomId: string): string => `${roomId}::affordanceRows`

export const affordanceRowCacheKey = (roomId: string, perspectiveKey: string): string =>
    `${roomId}::affordance::${perspectiveKey}`
