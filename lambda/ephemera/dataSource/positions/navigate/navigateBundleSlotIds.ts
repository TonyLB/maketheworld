/**
 * The messageOrchestration slot id for a navigate/home bundle's *header* render --- the room
 * description addressed to the mover alone. Navigate-owned: it is declared and consumed by
 * `orchestrateNavigate.ts`'s `registerIngressSlot`/`kickPassiveRenderRequestedForCharacterInRoom`
 * pair, a mechanism entirely separate from the presentation kernel, which is why
 * `compilePositionKernelOp` passes a caller-supplied `headerSlot` through untouched and never emits a
 * `describe` step for it.
 *
 * The leave/arrive slot ids that used to live here moved to
 * `manipulation/kernel/compile/moveBundleSlotIds.ts` in Phase 4, and widened from room-typed to
 * host-typed on the way (object take/drop puts a character on one side of the move). They belong to
 * the compiler now: it is the only thing that mints them, and both the declarer (`plan.slots`) and
 * the reporter (each narrate step's `slotId`) read them off the same compiled plan.
 */
export const NAVIGATE_HEADER_SLOT_ID = 'header'
