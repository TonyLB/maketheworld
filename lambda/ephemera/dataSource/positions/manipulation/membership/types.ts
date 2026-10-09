import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

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

