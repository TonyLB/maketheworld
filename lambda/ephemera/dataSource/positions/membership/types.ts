import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { RoomCharacterListItem } from '../../../internalCache/baseClasses'

export type RoomStackItem = {
    asset: string;
    RoomId: string;
    /** Epoch ms: navigate beatAnchorTime on frames this write applied. Omitted/0 = legacy. */
    timeWritten?: number;
}

/** Ingress-facing stable API (S1-7). */
export type MembershipApplyArgs = {
    characterId: EphemeraCharacterId;
    /** null = out of play (disconnect). */
    targetRoomId: EphemeraRoomId | null;
    /**
     * When supplied, called with the resolved
     * `MembershipDiff` once planning determines it (before commit) to build the committed step
     * sequence --- the compiler's `[capture, transfer, capture]` shape --- instead of a hand-built
     * bare `transferMembership` step. A callback, not a pre-built array, because the diff (`froms`/
     * `to`) is only known after this coordinator's own `planMembershipTransfer` call, which the
     * contract keeps here rather than duplicating in the caller. Navigate's route only, today; unset
     * for connect/disconnect/home, whose behavior is unchanged.
     */
    compileMutationSteps?: (diff: MembershipDiff) => readonly import('../manipulation/kernel/kernelStep').MutationKernelStep[];
    /**
     * Phase 2: set only by callers whose own compiled step sequence narrates this move synchronously
     * (navigate) --- suppresses the async membership-presentation fan-in's fact leg for this commit
     * (see `CharacterMovedPublishedPayload.narratedInline`) so it doesn't also publish. Default `false`.
     */
    narrationHandledInline?: boolean;
}

/** Object room placement apply (Phase 4). */
export type ObjectMembershipApplyArgs = {
    objectId: EphemeraObjectId;
    /** Target room host; null is not used here --- use applyObjectClearMembership for destruction. */
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
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraLudicGraphFieldPayload>>;
}

export type UpdateLudicGraphsResult =
    | MembershipGraphPersistSuccess
    | { ok: true; persisted: false; diff: MembershipDiff }
    | MembershipApplyErrorResult

export type MembershipApplySuccessResult = {
    ok: true;
    /** Set when changed; Model A / slice 1b fact anchor (F1-4). */
    beatAnchorTime?: number;
    /** Room roster snapshots after apply; derived via getRoomCharacterList after graph memo seed. */
    roomRosterSnapshots?: Partial<Record<EphemeraRoomId, RoomCharacterListItem[]>>;
    /** Phase 2: the commit's captured rosters (`MutationKernelCaptures`), passed through so a caller whose `compileMutationSteps` included capture steps can feed `presentStepSequence`'s narration branch. Empty when the committed steps carried no capture steps (every route but navigate today). */
    captures?: import('../manipulation/kernel/types').MutationKernelCaptures;
} & MembershipDiff

export type MembershipApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type MembershipApplyResult = MembershipApplySuccessResult | MembershipApplyErrorResult
