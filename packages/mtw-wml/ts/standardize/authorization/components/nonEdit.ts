import { StandardAuthorizationItem } from "./baseClasses"
import { StandardAuthRemove, StandardAuthReplace } from "./edits"
import StandardGrant from "./grant"

export type StandardAuthorizationNonEdit = StandardGrant

export const isStandardAuthorizationNonEdit = (item: any): item is StandardAuthorizationNonEdit => {
    return item instanceof StandardGrant
}

export const isStandardAuthorizationItem = (item: any): item is StandardAuthorizationItem => {
    return item instanceof StandardGrant || item instanceof StandardAuthRemove || item instanceof StandardAuthReplace
}
