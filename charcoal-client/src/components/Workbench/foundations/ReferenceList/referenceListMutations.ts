import { isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

/**
 * Remove a list entry by component identity. Uses StandardReference.sameKey (not
 * universalKey-then-local-key string fallback). Row id must be a ComponentUUID
 * (as from referenceListToItems); invalid ids no-op.
 */
export function removeReferenceFromListById(list: ReferenceList, id: string): void {
    if (!isSchemaComponentUUID(id)) {
        return
    }
    const target = new StandardReference(id)
    list._items = list.payload.filter((ref) => !ref.sameKey(target))
}
