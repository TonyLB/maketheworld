import { isStandardReferencePayloadData, StandardReferenceData } from "../../../components/dataTypes/reference";
import { checkAll } from "../../../components/dataTypes/typeguards";
import { isStandardGrant, StandardGrantData } from './grant'
import { AssetUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema";

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
    component?: StandardReferenceData;  // Undefined for global (Asset-level) grants
    grants: StandardAuthorizationData[];
}

export const isStandardAuthorizationResourceData = (arg: any): arg is StandardAuthorizationResourceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        (!('component' in arg) || arg.component === undefined || isStandardReferencePayloadData(arg.component)),
        ('grants' in arg && Array.isArray(arg.grants) && arg.grants.every(isStandardAuthorizationData))
    )
}

export type StandardAuthorizationCollectionData = {
    /**
     * @deprecated Legacy field. With UUID-based storage, this is just the universalKey with
     * the ASSET# prefix stripped, providing no additional value. Kept for backward compatibility.
     */
    key?: string;
    universalKey: AssetUUID;
    grants: StandardAuthorizationResourceData[];
}

export const isStandardAuthorizationCollection = (arg: any): arg is StandardAuthorizationCollectionData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('universalKey' in arg && typeof arg.universalKey === 'string' && isSchemaAssetUUID(arg.universalKey)),
        ('grants' in arg && Array.isArray(arg.grants) && arg.grants.every(isStandardAuthorizationResourceData))
    )
}
