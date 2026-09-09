import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

/**
 * Deterministic messageOrchestration slot ids for the leave/arrive narration a compiled `Move`
 * declares. Owned by the compiler, which is the only thing that mints them --- both the declarer
 * (`plan.slots`) and the reporter (`presentStepSequence`, off each narrate step's `slotId`) get them
 * from the same `compilePositionKernelOp` call, so nothing derives them independently any more.
 *
 * **Host-typed, not room-typed.** An object take/drop moves an entity between a room and a
 * *character* host, so a slot id must admit any `EphemeraMembershipHostId`. A slot id is a
 * bundle-local correlation string --- its typing tracks the compiler's own host union, not any one
 * route's narrower view of what a host is.
 *
 * `NAVIGATE_HEADER_SLOT_ID` deliberately stays in `navigateBundleSlotIds.ts`: the header render is a
 * separate, navigate-owned mechanism (`presentCharacterMove.ts`'s `registerIngressSlot`), not
 * something this compiler emits.
 */
export const moveLeaveSlotId = (hostId: EphemeraMembershipHostId): string => `leave:${hostId}`
export const MOVE_ARRIVE_SLOT_ID = 'arrive'
