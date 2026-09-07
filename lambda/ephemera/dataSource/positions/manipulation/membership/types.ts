import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { RoomCharacterListItem } from '../../../../internalCache/baseClasses'

export type RoomStackItem = {
    asset: string;
    RoomId: string;
    /** Epoch ms: navigate beatAnchorTime on frames this write applied. Omitted/0 = legacy. */
    timeWritten?: number;
}

export type MembershipApplyArgs = {
    characterId: EphemeraCharacterId;
    /** null = out of play (disconnect). */
    targetRoomId: EphemeraRoomId | null;
    /**
     * When supplied, called with the resolved
     * `MembershipDiff` once planning determines it (before commit) to build the committed step
     * sequence --- the compiler's `[capture, transfer, capture]` shape --- instead of a hand-built
     * bare `transferMembership` step. A callback, not a pre-built array, because the diff (`froms`/
     * `to`) is only known after `executeMembershipTransfer`'s own diff computation, which the
     * contract keeps there rather than duplicating in the caller. Navigate's route only, today; unset
     * for connect/disconnect/home, whose behavior is unchanged.
     */
    compileMutationSteps?: (diff: MembershipDiff) => readonly import('../kernel/kernelStep').MutationKernelStep[];
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
    captures?: import('../kernel/types').MutationKernelCaptures;
} & MembershipDiff

export type MembershipApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type MembershipApplyResult = MembershipApplySuccessResult | MembershipApplyErrorResult

/** Graph-diff semantics for Object Moved (D8): eligible membership host endpoints. */
export type ObjectMembershipDiff = {
    froms: EphemeraMembershipHostId[];
    to: EphemeraMembershipHostId | null;
    changed: boolean;
}
