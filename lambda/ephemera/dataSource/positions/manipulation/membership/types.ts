import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** Cross-host object membership apply (v1 takeHold: room -> character). */
export type ObjectTakeHoldApplyArgs = {
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
}

/** Cross-host object membership apply (v1 drop: character -> room). */
export type ObjectDropApplyArgs = {
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
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
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>;
    postApplyCharacterGraphs: Partial<Record<EphemeraCharacterId, EphemeraPlayPositionGraph>>;
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
