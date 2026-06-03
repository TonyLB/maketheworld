import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'

/**
 * Whether `target` is still linked in this asset's edit data (any ref sign on `_topLevel`
 * or any component `referencedKeys()` mention). Use on the **local** StandardForm only
 * (base + edit + pendingEdits), not merged inherited `getStandardForm`. Not
 * SchemaOrganization.isReferenced.
 */
export function isReferencedInAssetLayer(
    localForm: StandardForm,
    target: StandardReference
): boolean {
    const inTopLevel =
        localForm._topLevel?.payload.some((r) => r.sameKey(target)) ?? false
    if (inTopLevel) return true
    return localForm.referencedBy(target).length > 0
}
