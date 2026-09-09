import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { RoomCharacterListItem } from '../../../../internalCache/baseClasses'
import type { MessageOrchestrationSlotSpec } from '../../../messageOrchestration/localApiEvents'

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
    /** messageOrchestration bundle correlation id --- forwarded to `planCharacterMoveTransfer`, which bakes it into the compiled plan's narrate steps (if any). */
    bundleId: string;
    /** Selects leave/arrive copy-kind (`buildCharacterMoveOp.ts`) --- forwarded to `planCharacterMoveTransfer`. */
    intentKind: IntentKind;
    /** The intent's own departure room, used to pick exit-aware copy among possibly several `froms`. */
    intentFromRoomId?: EphemeraRoomId;
    /** Normalized exit label, navigate only --- selects `exitAware` copy. */
    exitName?: string;
    /**
     * Async header-slot resolution, supplied only by navigate/connect (whichever route needs a
     * rendered room header); disconnect/repair omit it. Forwarded to `planCharacterMoveTransfer`,
     * which calls it only once the move is confirmed changed and has a real destination --- see that
     * function's own doc comment for why a no-op move never pays for it.
     */
    resolveHeaderSlot?: (to: EphemeraRoomId) => Promise<MessageOrchestrationSlotSpec | null>;
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
    /** Phase 2: the commit's captured rosters (`MutationKernelCaptures`), passed through so a caller whose committed steps included capture steps can feed `presentStepSequence`'s narration branch. Empty when the committed steps carried no capture steps (every route but navigate today). */
    captures?: import('../kernel/types').MutationKernelCaptures;
    /** 3e, MS-2: the plan `planCharacterMoveTransfer` already compiled, carried through commit so `presentCharacterMove` (3f, MS-6 --- merged from the former `orchestrateCharacterNavigate`/`orchestrateCharacterDisconnect`) presents it rather than rebuilding it. Unset when `changed: false` (nothing was ever compiled). */
    plan?: import('../kernel/compile/compilePositionKernelOp').CompiledPositionKernelPlan;
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

/**
 * The full vocabulary of character-membership moves that carry compiled narration copy --- see
 * `buildCharacterMoveOp.ts` for how each kind selects `MembershipEmissionCopyKind`. Declared once
 * here; every narrower call site derives its own subset from this type rather than re-listing
 * literals, per `AGENT.contract.md`'s `intentKind` vocabulary note.
 */
export type IntentKind = 'navigate' | 'home' | 'connect' | 'disconnect'

/** `intentKind` as accepted by navigate's shared pre-commit planning machinery --- disconnect never reaches it (compiled as `intentKind: 'disconnect'` only for `planCharacterMoveTransfer`'s own vocabulary, not this one). */
export type NavigateIntentKind = Exclude<IntentKind, 'disconnect'>
