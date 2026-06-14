import type { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses'

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

export type ActiveCharacterRosterEntry = {
    EphemeraId: EphemeraCharacterId;
    DisplayName?: string;
    fileURL?: string;
    Color?: LegalCharacterColor;
    SessionIds?: string[];
}

export type MembershipApplySuccessResult = {
    ok: true;
    from: EphemeraRoomId | null;
    to: EphemeraRoomId | null;
    changed: boolean;
    /** Set when changed; Model A / slice 1b fact anchor (F1-4). */
    beatAnchorTime?: number;
    /** Room roster snapshots after apply; used by coordinator cache memo. */
    roomRosterSnapshots?: Partial<Record<EphemeraRoomId, ActiveCharacterRosterEntry[]>>;
}

export type MembershipApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type MembershipApplyResult = MembershipApplySuccessResult | MembershipApplyErrorResult
