import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AuthoredExample, AuthoredExampleSet } from '../../assets/components/componentExamples'
import { perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import { isAuthoritativeCacheRow, isCatalogRowStale } from './guards'
import { markStatesEqual } from './markState'
import {
    EPHEMERA_CACHE_PROVENANCE_AUTHORED,
    type EphemeraCacheCatalogRow,
    type EphemeraCacheDynamoItem,
    type EphemeraCacheRenderedContent,
} from './types'

export type AuthoredCatalogDriftResult =
    | { status: 'aligned' }
    | { status: 'missing' }
    | { status: 'corrupted' }

export type ClassifyAuthoredCatalogDriftParams = {
    catalogRow: EphemeraCacheCatalogRow;
    desiredSet: AuthoredExampleSet;
    materializedRows: EphemeraCacheDynamoItem[];
    perspective: Perspective;
};

const renderedContentEqual = (
    a: EphemeraCacheRenderedContent,
    b: EphemeraCacheRenderedContent
): boolean => JSON.stringify(a) === JSON.stringify(b)

const exampleMatchesMaterializedRow = (
    example: AuthoredExample,
    row: EphemeraCacheDynamoItem,
    perspective: Perspective
): boolean => {
    if (row.provenance.type !== EPHEMERA_CACHE_PROVENANCE_AUTHORED) {
        return false
    }
    if (row.situationId !== example.situationId) {
        return false
    }
    if (!markStatesEqual(row.markState, example.markState)) {
        return false
    }
    if (!renderedContentEqual(row.renderedContent, example.renderedContent)) {
        return false
    }
    if (row.provenance.type !== example.provenance.type) {
        return false
    }
    if (!row.perspectiveMatcher || !perspectiveMatches(row.perspectiveMatcher, perspective)) {
        return false
    }
    return true
}

/**
 * Pure diagnostics classifier: blueprint desired set vs version-gated materialized CACHE# rows.
 */
export function classifyAuthoredCatalogDrift(
    params: ClassifyAuthoredCatalogDriftParams
): AuthoredCatalogDriftResult {
    const { catalogRow, desiredSet, materializedRows, perspective } = params

    if (isCatalogRowStale(catalogRow)) {
        return { status: 'missing' }
    }

    const authoritativeAuthored = materializedRows.filter(
        (row) =>
            row.provenance.type === EPHEMERA_CACHE_PROVENANCE_AUTHORED
            && row.perspectiveMatcher
            && perspectiveMatches(row.perspectiveMatcher, perspective)
            && isAuthoritativeCacheRow(row, catalogRow)
    )

    const materializedBySituationId = new Map<ComponentUUID, EphemeraCacheDynamoItem>()
    for (const row of authoritativeAuthored) {
        if (row.situationId === undefined || materializedBySituationId.has(row.situationId as ComponentUUID)) {
            continue
        }
        materializedBySituationId.set(row.situationId as ComponentUUID, row)
    }

    const desiredSituationIds = new Set(desiredSet.keys())

    for (const situationId of materializedBySituationId.keys()) {
        if (!desiredSituationIds.has(situationId)) {
            return { status: 'corrupted' }
        }
    }

    for (const [situationId, example] of desiredSet) {
        const materialized = materializedBySituationId.get(situationId)
        if (materialized === undefined) {
            return { status: 'corrupted' }
        }
        if (!exampleMatchesMaterializedRow(example, materialized, perspective)) {
            return { status: 'corrupted' }
        }
    }

    return { status: 'aligned' }
}

export type ExpectedCacheRecordFromAuthoredExampleParams = {
    example: AuthoredExample;
    perspective: Perspective;
    perspectiveKey: string;
};

/** Maps AuthoredExample to put-comparable fields (shared with hydrate path). */
export function expectedCacheFieldsFromAuthoredExample(
    params: ExpectedCacheRecordFromAuthoredExampleParams
): Pick<
    EphemeraCacheDynamoItem,
    'markState' | 'renderedContent' | 'provenance' | 'perspectiveId' | 'perspectiveMatcher' | 'situationId'
> {
    const { example, perspective, perspectiveKey } = params
    return {
        markState: example.markState,
        renderedContent: example.renderedContent,
        provenance: example.provenance,
        situationId: example.situationId as EphemeraSituationId,
        perspectiveId: perspectiveKey,
        perspectiveMatcher: {
            requiredAssetIds: [...perspective.assetStack] as AssetUUID[],
            forbiddenAssetIds: [],
        },
    }
}
