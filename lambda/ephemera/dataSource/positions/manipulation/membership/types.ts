import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

/** Remove object from all membership hosts (destruction / clear). */
export type ObjectClearMembershipApplyArgs = {
    objectId: EphemeraObjectId;
}

/** Graph-diff semantics for Object Moved (D8): eligible membership host endpoints. */
export type ObjectMembershipDiff = {
    froms: EphemeraMembershipHostId[];
    to: EphemeraMembershipHostId | null;
    changed: boolean;
}

export type ClearMembershipApplySuccessResult = {
    ok: true;
    beatAnchorTime?: number;
} & ObjectMembershipDiff

export type ClearMembershipApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type ClearMembershipApplyResult = ClearMembershipApplySuccessResult | ClearMembershipApplyErrorResult
