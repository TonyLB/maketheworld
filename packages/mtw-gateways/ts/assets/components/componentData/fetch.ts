import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { AssetUUID, ComponentUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { componentTagFromUniversalKey } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { isStandardComponentData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

import type { PersistedReferencedByEntry } from './referencedBy'

/** Merge-body fields on a component pair Dynamo row (universalKey/tag supplied at read time). */
export type ComponentPairPersistedFields<
    T extends Record<string, unknown> = Omit<StandardComponentData, 'universalKey' | 'tag'>
> = T & {
    DataCategory?: AssetUUID
    referencedBy?: PersistedReferencedByEntry[]
}

/** assetDB PK convention for pair-addressed component rows. */
export type AssetDbGetItemsComponentRow = ComponentPairPersistedFields & {
    AssetId: ComponentUUID
}

/** ephemeraDB PK convention (same logical key, different attribute name). */
export type EphemeraDbGetItemsComponentRow = ComponentPairPersistedFields & {
    EphemeraId: ComponentUUID
}

/**
 * Maps a keyed Dynamo row from `getItems` into `{ assetId, component }` (pair-addressed path).
 * Accepts assetDB (`AssetId` PK) or ephemeraDB (`EphemeraId` PK) row shapes.
 */
export function standardComponentPairFromAssetDbGetItemsRow(
    EphemeraId: ComponentUUID,
    value: AssetDbGetItemsComponentRow | EphemeraDbGetItemsComponentRow
): { assetId: AssetUUID; component: StandardComponent; referencedBy?: PersistedReferencedByEntry[] } {
    const { DataCategory, referencedBy, ...pkAndFields } = value
    const componentFields = 'AssetId' in pkAndFields
        ? (({ AssetId: _assetId, ...rest }) => rest)(pkAndFields)
        : (({ EphemeraId: _ephemeraId, ...rest }) => rest)(pkAndFields)
    const assetId = DataCategory as AssetUUID
    const componentData = { universalKey: EphemeraId, tag: componentTagFromUniversalKey(EphemeraId), ...componentFields }
    if (!isStandardComponentData(componentData)) {
        throw new Error(`Invalid component data for EphemeraId: ${EphemeraId} and DataCategory: ${DataCategory}`)
    }
    const { component } = standardComponentFactory(componentData)
    if (!component) {
        throw new Error(`Failed to create component for EphemeraId: ${EphemeraId} and DataCategory: ${DataCategory}`)
    }
    return {
        assetId,
        component,
        ...(Array.isArray(referencedBy) ? { referencedBy: referencedBy as PersistedReferencedByEntry[] } : {}),
    }
}

export type ComponentAssetMetaAssetDB = {
    getItems: <Get extends Omit<StandardComponentData, 'universalKey' | 'tag'> & { DataCategory?: AssetUUID; AssetId: ComponentUUID }>(props: {
        Keys: { AssetId: ComponentUUID; DataCategory: AssetUUID }[]
        getAllFields: true
    }) => Promise<Get[]>
}

export async function fetchComponentsForAssets(
    assetDB: ComponentAssetMetaAssetDB,
    EphemeraId: ComponentUUID,
    assetIds: AssetUUID[]
): Promise<{ assetId: AssetUUID; component: StandardComponent; referencedBy?: PersistedReferencedByEntry[] }[]> {
    const queryKeys = assetIds.map((assetId) => ({
        AssetId: EphemeraId,
        DataCategory: assetId,
    }))

    const returnValues = await assetDB.getItems<
        Omit<StandardComponentData, 'universalKey' | 'tag'> & { DataCategory?: AssetUUID; AssetId: ComponentUUID }
    >({
        Keys: queryKeys,
        getAllFields: true,
    })

    const filteredResults = returnValues.filter((value) => {
        const assetId = value.DataCategory ?? ''
        return isSchemaAssetUUID(assetId)
    })

    return filteredResults.map((value) => standardComponentPairFromAssetDbGetItemsRow(EphemeraId, value))
}
