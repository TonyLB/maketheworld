import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

/**
 * Deterministic messageOrchestration slot ids for the leave/arrive narration a compiled `Move`
 * declares. Owned by the compiler, which is the only thing that mints them --- both the declarer
 * (`plan.slots`) and the reporter (`presentStepSequence`, off each narrate step's `slotId`) get them
 * from the same `compilePositionKernelOp` call, so nothing derives them independently any more.
 *
 * **Host-typed, not room-typed.** These lived in `positions/navigate/navigateBundleSlotIds.ts` and
 * took an `EphemeraRoomId` while navigate was the compiler's only consumer; the compiler bridged the
 * gap with an `asRoomId` force-cast. Phase 4's object take/drop moves an entity between a room and a
 * *character* host, so the cast had to go. A slot id is a bundle-local correlation string --- its
 * room-typing was incidental to navigate, never meaningful in itself.
 *
 * `NAVIGATE_HEADER_SLOT_ID` deliberately stays in `navigateBundleSlotIds.ts`: the header render is a
 * separate, navigate-owned mechanism (`orchestrateNavigate.ts`'s `registerIngressSlot`), not
 * something this compiler emits.
 */
export const moveLeaveSlotId = (hostId: EphemeraMembershipHostId): string => `leave:${hostId}`
export const MOVE_ARRIVE_SLOT_ID = 'arrive'
