import { StandardReferenceData } from "../../../components/dataTypes";
import { isStandardReferenceData } from "../../../components/dataTypes/reference";
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
    reference?: StandardReferenceData;
    grants: StandardAuthorizationData[];
}

export const isStandardAuthorizationResourceData = (arg: any): arg is StandardAuthorizationResourceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        (!('reference' in arg && arg.reference && !isStandardReferenceData(arg.reference))),
        ('grant' in arg && Array.isArray(arg.grants) && arg.grants.every(isStandardAuthorizationData))
    )
}

export type StandardAuthorizationCollectionData = {
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
