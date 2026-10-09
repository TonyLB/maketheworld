import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { RoomCharacterListItem } from '../../../../internalCache/baseClasses'
import type { MoveHeaderBinding } from '../kernel/compile/positionKernelOp'

export type MembershipApplyArgs = {
    characterId: EphemeraCharacterId;
    /** null = out of play (disconnect). */
    targetRoomId: EphemeraRoomId | null;
    /** Selects leave/arrive copy-kind (`buildCharacterMoveOp.ts`) --- forwarded to `planCharacterMoveTransfer`. */
    intentKind: IntentKind;
    /** The intent's own departure room, used to pick exit-aware copy among possibly several `froms`. */
    intentFromRoomId?: EphemeraRoomId;
    /** Normalized exit label, navigate only --- selects `exitAware` copy. */
    exitName?: string;
    /**
     * Async arrival-header resolution, supplied only by navigate/connect (whichever route needs a
     * rendered room header); disconnect/repair omit it. Forwarded to `planCharacterMoveTransfer`,
     * which calls it only once the move is confirmed changed and has a real destination --- see that
     * function's own doc comment for why a no-op move never pays for it.
     */
    resolveHeader?: (to: EphemeraRoomId) => Promise<MoveHeaderBinding | null>;
}

/**
 * Generic over the host id type so a narrower vocabulary derives from --- rather than merely
 * resembling --- the general one. Bare `MembershipDiff` (no type argument) is the host-general shape:
 * the kernel-step tier's vocabulary (`factsForStep`, `buildObjectMovedFact`, `buildCharacterMovedFact`),
 * since a single `transferMembership` step's `fromHostIds`/`toHostId` can carry a mix of object and
 * character entities against the same host set. `MembershipDiff<EphemeraRoomId>` is the character
 * route's own narrower, contract-enforced shape (a character's membership host is a Room, and only a
 * Room) --- its own orchestration-boundary type (`MembershipApplySuccessResult`), not kernel vocabulary.
 */
export type MembershipDiff<HostId extends EphemeraMembershipHostId = EphemeraMembershipHostId> = {
    /** Distinct prior in-play containers removed from (S2-4 / S2-7). */
    froms: HostId[];
    to: HostId | null;
    changed: boolean;
}

export type MembershipApplySuccessResult = {
    ok: true;
    /** Set when changed; Model A / slice 1b fact anchor (F1-4). */
    beatAnchorTime?: number;
    /** Room roster snapshots after apply; derived via getRoomCharacterList after graph memo seed. */
    roomRosterSnapshots?: Partial<Record<EphemeraRoomId, RoomCharacterListItem[]>>;
    /** Phase 2: the commit's captured rosters (`MutationKernelCaptures`), passed through so a caller whose committed steps included capture steps can feed `presentStepSequence`'s narration branch. Empty when the committed steps carried no capture steps (every route but navigate today). */
    captures?: import('../kernel/types').MutationKernelCaptures;
    /** 3e: the plan `planCharacterMoveTransfer` already compiled, carried through commit so `presentCharacterMove` (3f --- merged from the former `orchestrateCharacterNavigate`/`orchestrateCharacterDisconnect`) presents it rather than rebuilding it. Unset when `changed: false` (nothing was ever compiled). */
    plan?: import('../kernel/compile/compilePositionKernelOp').CompiledPositionKernelPlan;
} & MembershipDiff<EphemeraRoomId>

export type MembershipApplyErrorResult = {
    ok: false;
    errorCode: string;
    errorMessage: string;
}

export type MembershipApplyResult = MembershipApplySuccessResult | MembershipApplyErrorResult

/**
 * The full vocabulary of character-membership moves that carry compiled narration copy --- see
 * `buildCharacterMoveOp.ts` for how each kind selects `MembershipEmissionCopyKind`. Declared once
 * here; every narrower call site derives its own subset from this type rather than re-listing
 * literals, per `AGENT.contract.md`'s `intentKind` vocabulary note.
 */
export type IntentKind = 'navigate' | 'home' | 'connect' | 'disconnect'

