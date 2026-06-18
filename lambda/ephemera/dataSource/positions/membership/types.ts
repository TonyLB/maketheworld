import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { RoomCharacterListItem } from '../../../internalCache/baseClasses'

export type RoomStackItem = {
    asset: string;
    RoomId: string;
}

/** Ingress-facing stable API (S1-7). */
export type MembershipApplyArgs = {
    characterId: EphemeraCharacterId;
    /** null = out of play (disconnect). */
    targetRoomId: EphemeraRoomId | null;
}

/** Object room placement apply (Phase 4). */
export type ObjectMembershipApplyArgs = {
    objectId: EphemeraObjectId;
    /** null = removed from all rooms. */
    targetRoomId: EphemeraRoomId | null;
}

export type MembershipDiff = {
    /** Distinct prior in-play containers removed from (S2-4 / S2-7). */
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    changed: boolean;
}

export type MembershipGraphPersistSuccess = {
    ok: true;
    persisted: true;
    diff: MembershipDiff;
    /** Post-mutation room topology per affected room; coordinator seeds Positions memo. */
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>;
}

export type UpdatePositionGraphsResult =
    | MembershipGraphPersistSuccess
    | { ok: true; persisted: false; diff: MembershipDiff }
    | MembershipApplyErrorResult

export type MembershipApplySuccessResult = {
    ok: true;
    /** Set when changed; Model A / slice 1b fact anchor (F1-4). */
    beatAnchorTime?: number;
    /** Room roster snapshots after apply; derived via getRoomCharacterList after graph memo seed. */
    roomRosterSnapshots?: Partial<Record<EphemeraRoomId, RoomCharacterListItem[]>>;
} & MembershipDiff

export type MembershipApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type MembershipApplyResult = MembershipApplySuccessResult | MembershipApplyErrorResult
