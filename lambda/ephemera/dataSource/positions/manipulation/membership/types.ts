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
 * Cross-host object-*set* membership apply (Pipeline A -> B migration slice 1,
 * BD-13 slice 3 kernel half; v1 takeHold: room -> character). A carry-closed
 * transfer set (BD-13) moves atomically in one `applyHostEffects` call; a
 * `dissolve`-classified boundary edge needs no separate handling here --- it is
 * already stripped automatically when its in-set endpoint's node is removed
 * from the source graph (`EphemeraPositionGraph.removeObject`).
 */
export type ObjectSetTakeHoldApplyArgs = {
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    /** Internal relational edges (BD-13) carried with the set to the destination host. */
    carriedEdges?: HostRelationalEdgeCarry[];
}

/** Cross-host object-*set* membership apply (v1 drop: character -> room). */
export type ObjectSetDropApplyArgs = {
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    /** Internal relational edges (BD-13) carried with the set to the destination host. */
    carriedEdges?: HostRelationalEdgeCarry[];
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
