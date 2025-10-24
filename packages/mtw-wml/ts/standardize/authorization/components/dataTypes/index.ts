import { isStandardReferencePayloadData, StandardReferenceData } from "../../../components/dataTypes/reference";
import { checkAll } from "../../../components/dataTypes/typeguards";
import { isStandardGrant, StandardGrantData } from './grant'

export { StandardGrantData, isStandardGrant }

export type StandardAuthNonEditData =
    StandardGrantData
    
export type StandardAuthRemoveData = {
    tag: 'Remove';
    component: StandardAuthNonEditData;
}

export type StandardAuthReplaceData = {
    tag: 'Replace';
    match: StandardAuthNonEditData;
    payload: StandardAuthNonEditData;
}

export const isStandardAuthNonEditData = (value: any): value is StandardAuthNonEditData => (
    isStandardGrant(value)
)

export const isStandardAuthRemoveWithOptions = (options: { typeGuard?: (value: any) => boolean } = {}) => (arg: any): arg is StandardAuthRemoveData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Remove'),
        ('component' in arg && (options.typeGuard ?? isStandardAuthNonEditData)(arg.component))
    )
}

export const isStandardAuthRemove = isStandardAuthRemoveWithOptions()

export const isStandardAuthReplaceWithOptions = (options: { typeGuard?: (value: any) => boolean } = {}) => (arg: any): arg is StandardAuthReplaceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Replace'),
        ('match' in arg && (options.typeGuard ?? isStandardAuthNonEditData)(arg.match)),
        ('payload' in arg && (options.typeGuard ?? isStandardAuthNonEditData)(arg.payload))
    )
}

export const isStandardAuthReplace = isStandardAuthReplaceWithOptions()

export const unwrapStandardAuthComponent = (component: StandardAuthorizationData): StandardAuthNonEditData => {
    if (isStandardAuthNonEditData(component)) {
        return component
    }
    else if (isStandardAuthRemove(component)) {
        return component.component
    }
    else {
        return component.payload
    }
}

export type StandardAuthorizationData = StandardAuthNonEditData | StandardAuthRemoveData | StandardAuthReplaceData

export const isStandardAuthorizationData = (arg: any): arg is StandardAuthorizationData => (isStandardAuthNonEditData(arg) || isStandardAuthRemove(arg) || isStandardAuthReplace(arg))

export type StandardAuthorizationResourceData = {
    referenceStack: StandardReferenceData[];
    grants: StandardAuthorizationData[];
}

export const isStandardAuthorizationResourceData = (arg: any): arg is StandardAuthorizationResourceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('referenceStack' in arg && Array.isArray(arg.referenceStack) && arg.referenceStack.every(isStandardReferencePayloadData)),
        ('grants' in arg && Array.isArray(arg.grants) && arg.grants.every(isStandardAuthorizationData))
    )
}

/**
 * @todo FUNCTIONALITY GAP: Unlike StandardFormData, this type does not include a universalKey field.
 * This means authorization data cannot properly serialize/deserialize the AssetUUID, making
 * authorizations less capable than StandardForm. This should be fixed by adding:
 *   universalKey: AssetUUID;
 * and updating toJSON() to include it, similar to StandardForm.toJSON().
 */
export type StandardAuthorizationCollectionData = {
    /**
     * @deprecated Legacy field. With UUID-based storage, this is just the universalKey with
     * the ASSET# prefix stripped, providing no additional value. Kept for backward compatibility.
     */
    key: string;
    grants: StandardAuthorizationResourceData[];
}

export const isStandardAuthorizationCollection = (arg: any): arg is StandardAuthorizationCollectionData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('key' in arg && typeof arg.key === 'string'),
        ('grants' in arg && Array.isArray(arg.grants) && arg.grants.every(isStandardAuthorizationResourceData))
    )
}
