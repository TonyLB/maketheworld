/**
 * Structured CloudWatch logging for catalog hydrate preflight (affordance + render).
 * Filter: `[mtw.ephemera.affordanceCache] catalogHydrate` or `[mtw.ephemera.renderCache] catalogHydrate`.
 */

export type CatalogHydrateScope = 'affordanceCache' | 'renderCache'

const LOG_PREFIX: Record<CatalogHydrateScope, string> = {
    affordanceCache: '[mtw.ephemera.affordanceCache] catalogHydrate',
    renderCache: '[mtw.ephemera.renderCache] catalogHydrate',
}

export type CatalogVersionSnapshot = {
    catalogVersion?: number;
    hydratedCatalogVersion?: number;
    catalogStale: boolean;
    rowMissing: boolean;
}

export const catalogVersionSnapshot = (
    row: { catalogVersion: number; hydratedCatalogVersion: number } | undefined
): CatalogVersionSnapshot => {
    if (row === undefined) {
        return {
            catalogVersion: undefined,
            hydratedCatalogVersion: undefined,
            catalogStale: true,
            rowMissing: true,
        }
    }
    return {
        catalogVersion: row.catalogVersion,
        hydratedCatalogVersion: row.hydratedCatalogVersion,
        catalogStale: row.hydratedCatalogVersion < row.catalogVersion,
        rowMissing: false,
    }
}

export const logCatalogHydrate = (
    scope: CatalogHydrateScope,
    event: string,
    fields: Record<string, unknown> = {}
): void => {
    console.log(LOG_PREFIX[scope], { event, ...fields })
}

export const logCatalogHydrateError = (
    scope: CatalogHydrateScope,
    event: string,
    fields: Record<string, unknown> = {}
): void => {
    console.error(LOG_PREFIX[scope], { event, ...fields })
}

export const catalogHydrateErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)
