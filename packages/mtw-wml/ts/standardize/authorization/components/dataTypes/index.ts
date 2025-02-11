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

export const isStandardAuthNonEdit = (value: any): value is StandardAuthNonEditData => (
    isStandardGrant(value)
)

export const isStandardAuthRemoveWithOptions = (options: { typeGuard?: (value: any) => boolean } = {}) => (arg: any): arg is StandardAuthRemoveData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Remove'),
        ('component' in arg && (options.typeGuard ?? isStandardAuthNonEdit)(arg.component))
    )
}

export const isStandardAuthRemove = isStandardAuthRemoveWithOptions()

export const isStandardAuthReplaceWithOptions = (options: { typeGuard?: (value: any) => boolean } = {}) => (arg: any): arg is StandardAuthReplaceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Replace'),
        ('match' in arg && (options.typeGuard ?? isStandardAuthNonEdit)(arg.match)),
        ('payload' in arg && (options.typeGuard ?? isStandardAuthNonEdit)(arg.payload))
    )
}

export const isStandardAuthReplace = isStandardAuthReplaceWithOptions()

export const unwrapStandardAuthComponent = (component: StandardAuthorizationData): StandardAuthNonEditData => {
    if (isStandardAuthNonEdit(component)) {
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

export const isStandardAuthorizationItem = (arg: any): arg is StandardAuthorizationData => (isStandardAuthNonEdit(arg) || isStandardAuthRemove(arg) || isStandardAuthReplace(arg))
