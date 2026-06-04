import { isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

/**
 * Remove a list entry by component identity. Uses StandardReference.sameKey (not
 * universalKey-then-local-key string fallback). Row id must be a ComponentUUID
 * (as from referenceListToItems); invalid ids no-op.
 */
export function referenceTargetFromId(id: string): StandardReference | undefined {
    if (!isSchemaComponentUUID(id)) {
        return undefined
    }
    return new StandardReference(id)
}

/** Find a list entry by ComponentUUID row id (sameKey, not key string equality). */
export function findReferenceInListById(
    list: ReferenceList,
    id: string
): StandardReference | undefined {
    const target = referenceTargetFromId(id)
    if (!target) {
        return undefined
    }
    return list.payload.find((ref) => ref.sameKey(target))
}

export function removeReferenceFromListById(list: ReferenceList, id: string): void {
    const target = referenceTargetFromId(id)
    if (!target) {
        return
    }
    list._items = list.payload.filter((ref) => !ref.sameKey(target))
}

/** Roster pin: positive ref on _topLevel (ref={1} is the default pin). */
export function isPinnedOnTopLevel(list: ReferenceList, id: string): boolean {
    const target = referenceTargetFromId(id)
    if (!target) {
        return false
    }
    return list.payload.some((ref) => ref.sameKey(target) && ref.ref >= 1)
}

export function pinReferenceOnTopLevel(list: ReferenceList, ref: StandardReference): ReferenceList {
    return list.assureItem(ref.withRef(1))
}
