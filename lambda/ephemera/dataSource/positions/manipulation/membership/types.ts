import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { HostRelationalEdgeCarry } from '../types'

/** Cross-host object membership apply (v1 takeHold: room -> character). */
export type ObjectTakeHoldApplyArgs = {
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    /** Internal relational edges (BD-13) carried with the object to the destination host. */
    carriedEdges?: HostRelationalEdgeCarry[];
}

/** Cross-host object membership apply (v1 drop: character -> room). */
export type ObjectDropApplyArgs = {
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    /** Internal relational edges (BD-13) carried with the object to the destination host. */
    carriedEdges?: HostRelationalEdgeCarry[];
}

/**
 * Cross-host object-*set* membership apply (v1 takeHold: room -> character). A
 * carry-closed transfer set (BD-13) moves atomically via `applyObjectSetTransfer`'s
 * `MultiKeyUpdate`-based reducer (Pipeline A -> B migration slice 3, 2026-07-15),
 * which derives internal edges and re-validates boundary-edge classification
 * against freshly-fetched state at commit time --- no `carriedEdges` param, since
 * nothing is precomputed and passed in.
 */
export type ObjectSetTakeHoldApplyArgs = {
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
}

/** Cross-host object-*set* membership apply (v1 drop: character -> room). */
export type ObjectSetDropApplyArgs = {
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
}

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

export type TakeHoldGraphPersistSuccess = {
    ok: true;
    persisted: true;
    diff: ObjectMembershipDiff;
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload>>;
    postApplyCharacterGraphs: Partial<Record<EphemeraCharacterId, EphemeraPositionGraphFieldPayload>>;
}

export type UpdateTakeHoldPositionGraphsResult =
    | TakeHoldGraphPersistSuccess
    | { ok: true; persisted: false; diff: ObjectMembershipDiff }
    | { ok: false; errorCode: string; errorMessage: string }

export type TakeHoldApplySuccessResult = {
    ok: true;
    beatAnchorTime?: number;
} & ObjectMembershipDiff

export type TakeHoldApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type TakeHoldApplyResult = TakeHoldApplySuccessResult | TakeHoldApplyErrorResult

export type DropApplySuccessResult = {
    ok: true;
    beatAnchorTime?: number;
} & ObjectMembershipDiff

export type DropApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type DropApplyResult = DropApplySuccessResult | DropApplyErrorResult

/** One object's membership diff within a set-apply call (Pipeline A -> B migration slice 1). */
export type ObjectSetMembershipDiff = { objectId: EphemeraObjectId } & ObjectMembershipDiff

export type TakeHoldSetApplySuccessResult = {
    ok: true;
    beatAnchorTime?: number;
    diffs: ObjectSetMembershipDiff[];
}

export type TakeHoldSetApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type TakeHoldSetApplyResult = TakeHoldSetApplySuccessResult | TakeHoldSetApplyErrorResult

export type DropSetApplySuccessResult = {
    ok: true;
    beatAnchorTime?: number;
    diffs: ObjectSetMembershipDiff[];
}

export type DropSetApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type DropSetApplyResult = DropSetApplySuccessResult | DropSetApplyErrorResult

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
